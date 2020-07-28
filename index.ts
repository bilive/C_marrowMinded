import Plugin, { tools, AppClient } from '../../plugin'

class MarrowMinded extends Plugin {
  constructor() {
    super()
  }
  public name = '小心心'
  public description = '自动获取小心心'
  public version = '0.0.1'
  public author = 'lzghzr'
  /**
   * 任务表
   *
   * @private
   * @type {Map<string, boolean>}
   * @memberof MarrowMinded
   */
  private _heartBeatList: Map<string, boolean> = new Map()
  /**
   * 暂存的用户指纹信息
   *
   * @private
   * @type {Map<string,Record<string,string>>}
   * @memberof MarrowMinded
   */
  private _userBody: Map<string, Record<string, string>> = new Map()
  public async load({ defaultOptions, whiteList, version }: { defaultOptions: options, whiteList: Set<string>, version: version }) {
    if (version === undefined || version.major !== 2 || version.minor < 2) {
      tools.Log('小心心插件', '主程序版本不兼容', '需要2.2.0以上')
      this.loaded = false
    }
    else {
      // 小心心
      defaultOptions.newUserData['marrowMinded'] = false
      defaultOptions.info['marrowMinded'] = {
        description: '小心心',
        tip: '自动获取小心心',
        type: 'boolean'
      }
      whiteList.add('marrowMinded')
      this.loaded = true
    }
  }
  public async start({ users }: { users: Map<string, User> }) {
    this._marrowMinded(users)
  }
  public async loop({ cstMin, cstHour, cstString, users }: { cstMin: number, cstHour: number, cstString: string, users: Map<string, User> }) {
    // 每天00:10刷新任务
    if (cstString === '00:10') this._heartBeatList.clear()
    // 每天04:30, 12:30, 20:30做任务
    if (cstMin === 30 && cstHour % 8 === 4) this._marrowMinded(users)
  }
  private _marrowMinded(users: Map<string, User>) {
    users.forEach(async (user, uid) => {
      if (this._heartBeatList.get(uid) || !user.userData['marrowMinded']) return
      const giftNum = await this._getGiftNum(user)
      if (giftNum >= 24) {
        this._heartBeatList.set(uid, true)
        tools.Log(user.nickname, '小心心', '已获取今日小心心')
      }
      else {
        if (!this._userBody.has(uid)) {
          const body = {
            platform: user.platform,
            uuid: AppClient.UUID,
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
            gu_id: AppClient.RandomHex(43),
            play_type: '0',
            play_url: '',
            s_time: '0',
            data_behavior_id: '',
            data_source_id: '',
            up_session: '',
            visit_id: AppClient.RandomHex(32),
            watch_status: '%7B%22pk_id%22%3A0%2C%22screen_status%22%3A1%7D',
            click_id: '',
            session_id: '-99998',
            player_type: '0',
            client_ts: ''
          }
          this._userBody.set(uid, body)
        }
        const postJSON = <Record<string, string>>this._userBody.get(uid)
        const userFansMedal = await this._getFansMedal(user)
        if (userFansMedal !== undefined) {
          const control = 24 - giftNum
          const loopNum = Math.ceil(control / userFansMedal.length)
          let count = 0
          for (let i = 0; i < loopNum; i++) {
            for (const funsMedalData of userFansMedal) {
              if (count >= control) break
              const { room_id, target_id, last_wear_time } = funsMedalData
              const ts = AppClient.TS
              const medalJSON = Object.assign({}, postJSON, {
                room_id: room_id.toString(),
                up_id: target_id.toString(),
                up_session: `l:one:live:record:${room_id}:${last_wear_time}`,
                timestamp: (ts - 300).toString(),
                client_ts: ts.toString()
              })
              await this._postHearBeat(user, medalJSON)
              count++
            }
            if (count >= control) break
            else await tools.Sleep(300 * 1000)
          }
          await tools.Sleep(5 * 1000)
          const finishedGiftNum = await this._getGiftNum(user)
          if (finishedGiftNum >= 24) {
            this._heartBeatList.set(uid, true)
            tools.Log(user.nickname, '小心心', '已获取今日小心心')
          }
          else tools.Log(user.nickname, '小心心', '未获取到足够的小心心, 将下次尝试')
        }
      }
    })
  }
  /**
   * 计算client_sign
   *
   * @private
   * @param {Record<string, string>} postJSON
   * @returns
   * @memberof MarrowMinded
   */
  private _sign(postJSON: Record<string, string>) {
    return tools.Hash('BLAKE2b512',
      tools.Hash('SHA3-384',
        tools.Hash('SHA384',
          tools.Hash('SHA3-512',
            tools.Hash('SHA512', JSON.stringify(postJSON))
          )
        )
      )
    )
  }
  /**
   * 发送心跳
   *
   * @private
   * @param {User} user
   * @param {Record<string, string>} postJSON
   * @returns {Promise<boolean>}
   * @memberof MarrowMinded
   */
  private async _postHearBeat(user: User, postJSON: Record<string, string>): Promise<boolean> {
    const clientSign = this._sign(postJSON)
    let postData = ''
    for (const i in postJSON) postData += `${i}=${encodeURIComponent(postJSON[i])}&`
    postData += `client_sign=${clientSign}`
    const mobileHeartBeat: XHRoptions = {
      method: 'POST',
      url: 'https://live-trace.bilibili.com/xlive/data-interface/v1/heartbeat/mobileHeartBeat',
      body: AppClient.signQuery(`${user.tokenQuery}&${postData}&actionKey=${user.actionKey}&appkey=${user.appKey}&build=${user.build}&channel=${user.channel}&device=${user.device}&mobi_app=${user.mobiApp}&statistics=${user.statistics}`),
      responseType: 'json',
      headers: user.headers
    }
    const postMobileHeartBeat = await tools.XHR<mobileHeartBeat>(mobileHeartBeat, 'Android')
    if (postMobileHeartBeat !== undefined && postMobileHeartBeat.response.statusCode === 200)
      if (postMobileHeartBeat.body.code === 0) return true
      else tools.Log(user.nickname, '小心心', '发送心跳', postMobileHeartBeat.body)
    else tools.Log(user.nickname, '小心心', '发送心跳', '网络错误')
    return false
  }
  /**
   * 获取勋章数据
   *
   * @private
   * @param {User} user
   * @returns {(Promise<fansMedalData[] | void>)}
   * @memberof MarrowMinded
   */
  private async _getFansMedal(user: User): Promise<fansMedalData[] | void> {
    const funsMedals: XHRoptions = {
      url: `https://api.live.bilibili.com/fans_medal/v1/FansMedal/get_list_in_room?${AppClient.signQueryBase(`${user.tokenQuery}&target_id=11153765&uid=${user.biliUID}`)}`,
      responseType: 'json',
      headers: user.headers
    }
    const getFunsMedals = await tools.XHR<fansMedal>(funsMedals, 'Android')
    if (getFunsMedals !== undefined && getFunsMedals.response.statusCode === 200)
      if (getFunsMedals.body.code === 0)
        if (getFunsMedals.body.data.length > 0) return getFunsMedals.body.data
        else tools.Log(user.nickname, '小心心', '勋章信息', '未获得勋章')
      else tools.Log(user.nickname, '小心心', '勋章信息', getFunsMedals.body)
    else tools.Log(user.nickname, '小心心', '勋章信息', '网络错误')
  }
  /**
   * 获取小心心数量
   *
   * @private
   * @param {User} user
   * @returns {Promise<number>}
   * @memberof MarrowMinded
   */
  private async _getGiftNum(user: User): Promise<number> {
    let count = 0
    const bag: XHRoptions = {
      url: `https://api.live.bilibili.com/xlive/app-room/v1/gift/bag_list?${AppClient.signQueryBase(`${user.tokenQuery}&room_id=23058`)}`,
      responseType: 'json',
      headers: user.headers
    }
    const bagInfo = await tools.XHR<bagList>(bag, 'Android')
    if (bagInfo !== undefined && bagInfo.response.statusCode === 200)
      if (bagInfo.body.code === 0) {
        if (bagInfo.body.data.list.length > 0)
          for (const giftData of bagInfo.body.data.list) {
            if (giftData.gift_id === 30607) {
              const expire = (giftData.expire_at - Date.now() / 1000) / 60 / 60 / 24
              if (expire > 6 && expire <= 7) count += giftData.gift_num
            }
          }
      }
      else tools.Log(user.nickname, '小心心', '包裹信息', bagInfo.body)
    else tools.Log(user.nickname, '小心心', '包裹信息', '网络错误')
    return count
  }
}

export default new MarrowMinded()

/**
 * 包裹信息
 *
 * @interface bagList
 */
interface bagList {
  code: number
  message: string
  ttl: number
  data: bagListData
}
interface bagListData {
  list: bagListDataList[]
  time: number
}
interface bagListDataList {
  bag_id: number
  gift_id: number
  gift_name: string
  gift_num: number
  gift_type: number
  expire_at: number
  corner_mark: string
  corner_color: string
  count_map: bagListDataListCountMap[]
  bind_roomid: number
  bind_room_text: string
  type: number
  card_image: string
  card_gif: string
  card_id: number
  card_record_id: number
  is_show_send: boolean
}
interface bagListDataListCountMap {
  num: number
  text: '' | '全部'
}
/**
 * 勋章信息
 *
 * @interface fansMedal
 */
interface fansMedal {
  code: number
  msg: string
  message: string
  data: fansMedalData[]
}
interface fansMedalData {
  uid: number
  target_id: number
  medal_id: number
  score: number
  level: number
  intimacy: number
  status: number
  source: number
  receive_channel: number
  is_receive: number
  master_status: number
  receive_time: string
  today_intimacy: number
  last_wear_time: number
  is_lighted: number
  medal_level: number
  next_intimacy: number
  day_limit: number
  medal_name: string
  master_available: number
  guard_type: number
  lpl_status: number
  can_delete: boolean
  target_name: string
  target_face: string
  live_stream_status: number
  icon_code: number
  icon_text: string
  rank: string
  medal_color: number
  medal_color_start: number
  medal_color_end: number
  guard_level: number
  medal_color_border: number
  today_feed: number
  buff_msg: string
  room_id: number
  sup_code: number
  sup_text: string
}
/**
 * 小心心
 *
 * @interface mobileHeartBeat
 */
interface mobileHeartBeat {
  code: number
  message: string
  ttl: number
  data: mobileHeartBeatData
}

interface mobileHeartBeatData {
  heartbeat_interval: number
  timestamp: number
  secret_rule: number[]
  secret_key: string
}
