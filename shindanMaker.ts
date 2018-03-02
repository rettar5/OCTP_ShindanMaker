import { OdnTweetData, OdnTweets } from "../../../odnTweets"
import { OdnProfiles } from "../../../odnProfiles";
import { OdnPlugins, OdnPluginResultData } from "../../../odnPlugins";
import { Log, OdnUtils } from "../../../odnUtils";
import { TwitterProfileConfigs } from "../../../configs/twitterProfileConfigs";
const request = require("request");

export class ShindanMaker {
  constructor(private tweetData: OdnTweetData, private fullName: string) {}

  /**
   * プラグインのメイン処理を実行
   *
   * @param {(isProcessed?: boolean) => void} finish
   */
  run(finish: (isProcessed?: boolean) => void) {
    Log.t(this.tweetData.text);
    const profile = TwitterProfileConfigs.getProfile(this.tweetData.accountData.userId);
    const name = this.tweetData.action && 0 < this.tweetData.action.length ? this.tweetData.action : profile.name;
    this.getShindanResult(this.tweetData.entities.urls[0].expandedUrl, name, (isSuccess, message) => {
      const tweets = new OdnTweets(this.tweetData.accountData);
      if (isSuccess) {
        tweets.text = message;
      } else {
        tweets.text = ".@" + this.tweetData.user.screenName + " 診断に失敗しました。 (" + this.tweetData.entities.urls[0].expandedUrl + ")";
      }
      tweets.targetTweetId = this.tweetData.idStr;
      tweets.postTweet((isSuccess) => {
        tweets.likeTweet();
        finish();
      });
    });
  }

  /**
   * プラグインを実行するかどうか判定
   *
   * @param {OdnTweetData} tweetData
   * @returns {boolean}
   */
  static isValid(tweetData: OdnTweetData): boolean {
    const url = tweetData.entities.urls && 0 < tweetData.entities.urls.length ? tweetData.entities.urls[0].expandedUrl : "";
    let result: boolean = true;
    result = result ? false === tweetData.isRetweet && tweetData.isReplyToMe() : false;
    // URLに診断メーカのURLが含まれている
    result = result ? (url.match(/[htps:\/]*shindanmaker\.com\/[0-9]+/gi) ? true : false) : false;
    // コマンドがURLの形式
    result = result ? (tweetData.command.match(/https:\/\/.+/gi) ? true : false) : false;
    return result;
  }

  /**
   * 診断結果を取得
   *
   * @param {string} url
   * @param {string} name
   * @param {(isSuccess: boolean, message: string) => void} callback
   */
  getShindanResult(url: string, name: string, callback: (isSuccess: boolean, message: string) => void) {
    // 診断メーカにはhttpsでなければアクセスできないため置換
    url = url.replace(/^http:/, "https:");
    const options = {
      uri: url,
      form: { u: name },
      json: false
    };

    request.post(options, (error, response, body) => {
      let isSuccess = error ? false : true;
      const matchList = body.match(/<textarea\sid="copy_text_140"(.|\r|\n)*?<\/textarea>/mig);
      Log.d("matchList: ", matchList);
      if (matchList && 0 < matchList.length) {
        const result = matchList[0].replace(/<(\/)?textarea[^>]*>/gi, "");
        callback(isSuccess, result);
      } else {
        callback(false, null);
      }
    });
  }
}
