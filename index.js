"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = __importStar(require("../../plugin"));
class MarrowMinded extends plugin_1.default {
    constructor() {
        super();
        this.name = '小心心';
        this.description = '自动获取小心心';
        this.version = '0.0.1';
        this.author = 'lzghzr';
        this._heartBeatList = new Map();
        this._userBody = new Map();
    }
    async load({ defaultOptions, whiteList, version }) {
        if (version === undefined || version.major !== 2 || version.minor < 2) {
            plugin_1.tools.Log('小心心插件', '主程序版本不兼容', '需要2.2.0以上');
            this.loaded = false;
        }
        else {
            defaultOptions.newUserData['marrowMinded'] = false;
            defaultOptions.info['marrowMinded'] = {
                description: '小心心',
                tip: '自动获取小心心',
                type: 'boolean'
            };
            whiteList.add('marrowMinded');
            this.loaded = true;
        }
    }
    async start({ users }) {
        this._marrowMinded(users);
    }
    async loop({ cstMin, cstHour, cstString, users }) {
        if (cstString === '00:10')
            this._heartBeatList.clear();
        if (cstMin === 30 && cstHour % 8 === 4)
            this._marrowMinded(users);
    }
    _marrowMinded(users) {
        users.forEach(async (user, uid) => {
            if (this._heartBeatList.get(uid) || !user.userData['marrowMinded'])
                return;
            const giftNum = await this._getGiftNum(user);
            if (giftNum >= 24) {
                this._heartBeatList.set(uid, true);
                plugin_1.tools.Log(user.nickname, '小心心', '已获取今日小心心');
            }
            else {
                if (!this._userBody.has(uid)) {
                    const body = {
                        platform: user.platform,
                        uuid: plugin_1.AppClient.UUID,
                        buvid: user.build,
                        seq_id: '1',
                        room_id: '',
                        parent_id: '6',
                        area_id: '283',
                        timestamp: '',
                        secret_key: 'axoaadsffcazxksectbbb',
                        watch_time: '300',
                        up_id: '',
                        up_level: '40',
                        jump_from: '30000',
                        gu_id: plugin_1.AppClient.RandomHex(43),
                        play_type: '0',
                        play_url: '',
                        s_time: '0',
                        data_behavior_id: '',
                        data_source_id: '',
                        up_session: '',
                        visit_id: plugin_1.AppClient.RandomHex(32),
                        watch_status: '%7B%22pk_id%22%3A0%2C%22screen_status%22%3A1%7D',
                        click_id: '',
                        session_id: '-99998',
                        player_type: '0',
                        client_ts: ''
                    };
                    this._userBody.set(uid, body);
                }
                const postJSON = this._userBody.get(uid);
                const userFansMedal = await this._getFansMedal(user);
                if (userFansMedal !== undefined) {
                    const control = 24 - giftNum;
                    const loopNum = Math.ceil(control / userFansMedal.length);
                    let count = 0;
                    for (let i = 0; i < loopNum; i++) {
                        for (const funsMedalData of userFansMedal) {
                            if (count >= control)
                                break;
                            const { room_id, target_id, last_wear_time } = funsMedalData;
                            const ts = plugin_1.AppClient.TS;
                            const medalJSON = Object.assign({}, postJSON, {
                                room_id: room_id.toString(),
                                up_id: target_id.toString(),
                                up_session: `l:one:live:record:${room_id}:${last_wear_time}`,
                                timestamp: (ts - 300).toString(),
                                client_ts: ts.toString()
                            });
                            await this._postHearBeat(user, medalJSON);
                            count++;
                        }
                        if (count >= control)
                            break;
                        else
                            await plugin_1.tools.Sleep(300 * 1000);
                    }
                    await plugin_1.tools.Sleep(5 * 1000);
                    const finishedGiftNum = await this._getGiftNum(user);
                    if (finishedGiftNum >= 24) {
                        this._heartBeatList.set(uid, true);
                        plugin_1.tools.Log(user.nickname, '小心心', '已获取今日小心心');
                    }
                    else
                        plugin_1.tools.Log(user.nickname, '小心心', '未获取到足够的小心心, 将下次尝试');
                }
            }
        });
    }
    _sign(postJSON) {
        return plugin_1.tools.Hash('BLAKE2b512', plugin_1.tools.Hash('SHA3-384', plugin_1.tools.Hash('SHA384', plugin_1.tools.Hash('SHA3-512', plugin_1.tools.Hash('SHA512', JSON.stringify(postJSON))))));
    }
    async _postHearBeat(user, postJSON) {
        const clientSign = this._sign(postJSON);
        let postData = '';
        for (const i in postJSON)
            postData += `${i}=${encodeURIComponent(postJSON[i])}&`;
        postData += `client_sign=${clientSign}`;
        const mobileHeartBeat = {
            method: 'POST',
            url: 'https://live-trace.bilibili.com/xlive/data-interface/v1/heartbeat/mobileHeartBeat',
            body: plugin_1.AppClient.signQuery(`${user.tokenQuery}&${postData}&actionKey=${user.actionKey}&appkey=${user.appKey}&build=${user.build}&channel=${user.channel}&device=${user.device}&mobi_app=${user.mobiApp}&statistics=${user.statistics}`),
            responseType: 'json',
            headers: user.headers
        };
        const postMobileHeartBeat = await plugin_1.tools.XHR(mobileHeartBeat, 'Android');
        if (postMobileHeartBeat !== undefined && postMobileHeartBeat.response.statusCode === 200)
            if (postMobileHeartBeat.body.code === 0)
                return true;
            else
                plugin_1.tools.Log(user.nickname, '小心心', '发送心跳', postMobileHeartBeat.body);
        else
            plugin_1.tools.Log(user.nickname, '小心心', '发送心跳', '网络错误');
        return false;
    }
    async _getFansMedal(user) {
        const funsMedals = {
            url: `https://api.live.bilibili.com/fans_medal/v1/FansMedal/get_list_in_room?${plugin_1.AppClient.signQueryBase(`${user.tokenQuery}&target_id=11153765&uid=${user.biliUID}`)}`,
            responseType: 'json',
            headers: user.headers
        };
        const getFunsMedals = await plugin_1.tools.XHR(funsMedals, 'Android');
        if (getFunsMedals !== undefined && getFunsMedals.response.statusCode === 200)
            if (getFunsMedals.body.code === 0)
                if (getFunsMedals.body.data.length > 0)
                    return getFunsMedals.body.data;
                else
                    plugin_1.tools.Log(user.nickname, '小心心', '勋章信息', '未获得勋章');
            else
                plugin_1.tools.Log(user.nickname, '小心心', '勋章信息', getFunsMedals.body);
        else
            plugin_1.tools.Log(user.nickname, '小心心', '勋章信息', '网络错误');
    }
    async _getGiftNum(user) {
        let count = 0;
        const bag = {
            url: `https://api.live.bilibili.com/xlive/app-room/v1/gift/bag_list?${plugin_1.AppClient.signQueryBase(`${user.tokenQuery}&room_id=23058`)}`,
            responseType: 'json',
            headers: user.headers
        };
        const bagInfo = await plugin_1.tools.XHR(bag, 'Android');
        if (bagInfo !== undefined && bagInfo.response.statusCode === 200)
            if (bagInfo.body.code === 0) {
                if (bagInfo.body.data.list.length > 0)
                    for (const giftData of bagInfo.body.data.list) {
                        if (giftData.gift_id === 30607) {
                            const expire = (giftData.expire_at - Date.now() / 1000) / 60 / 60 / 24;
                            if (expire > 6 && expire <= 7)
                                count += giftData.gift_num;
                        }
                    }
            }
            else
                plugin_1.tools.Log(user.nickname, '小心心', '包裹信息', bagInfo.body);
        else
            plugin_1.tools.Log(user.nickname, '小心心', '包裹信息', '网络错误');
        return count;
    }
}
exports.default = new MarrowMinded();
