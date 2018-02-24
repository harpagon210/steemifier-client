import jQuery from 'jquery'
import '../css/steemifier.scss'
import * as steem from 'steem'
// babel-polyfill required for the async/wait
import 'babel-polyfill' // eslint-disable-line no-unused-vars
import UploadButton from '../../modules/UploadButton'
import Author from '../../modules/Author'
import FollowButton from '../../modules/FollowButton'
import Counters from '../../modules/Counters'
import Comments from '../../modules/Comments'
import * as common from '../../modules/common'

var pageHref = window.location.href
var pagePath = window.location.pathname

class Steemifier {
  constructor () {
    this.components = []
    this.rewardBalance = null
    this.recentClaims = null
    this.steemPrice = null
    this.followers = null
    this.post = null
    this.author = null
    this.permlink = null
    this.youtubeVideoId = null

    steem.api.setOptions({url: 'https://api.steemit.com'})
  }

  getContentSteemInformation (contentId) {
    return new Promise(resolve => {
      // const url = `http://localhost:3000/content/${contentId}`
      console.log('process.env.STEEMIFIER_SERVER_URL: ' + process.env.STEEMIFIER_SERVER_URL)
      const url = `${process.env.STEEMIFIER_SERVER_URL}/content/${contentId}`
      fetch(url, { // eslint-disable-line no-undef
        method: 'GET'
      })
        .then(response => {
          if (response.ok) {
            return Promise.resolve(response)
          } else {
            return Promise.reject(new Error('Failed to load'))
          }
        })
        .then(response => response.json()) // parse response as JSON
        .then(steemInfo => {
          resolve(steemInfo)
        }).catch((error) => {
          console.log(`Error: ${error.message}`)
        })
    })
  }

  isContentSteemified (contentId) {
    return new Promise(resolve => {
      this.getContentSteemInformation(contentId)
        .then(steemInfo => {
          if (steemInfo) {
            this.author = steemInfo.author
            this.permlink = steemInfo.permlink
            resolve(true)
          } else {
            resolve(false)
          }
        })
    })
  }

  getActiveVotesAsync (author, permlink) {
    try {
      return steem.api.getActiveVotesAsync(author, permlink)
    } catch (err) {
      console.error('An error occured while retrieving the data', err)
    }
  }

  getFollowers (username) {
    return new Promise(async resolve => {
      let retVal = []
      let startFollower = ''
      const followCount = await steem.api.getFollowCountAsync(username)
      const count = followCount.follower_count
      for (let i = 0; i < count; i += 1000) {
        let temp = await steem.api.getFollowersAsync(username, startFollower, 'blog', 1000)
        Array.prototype.push.apply(retVal, temp)
        startFollower = retVal[retVal.length - 1].follower
      }
      resolve(retVal)
    })
  }

  getContentAsync (author, permlink) {
    try {
      return steem.api.getContentAsync(author, permlink)
    } catch (err) {
      console.error('An error occured while retrieving the data', err)
    }
  }

  getContentRepliesAsync (author, permlink) {
    try {
      return steem.api.getContentRepliesAsync(author, permlink)
    } catch (err) {
      console.error('An error occured while retrieving the data', err)
    }
  }

  loadDataWatchUI () {
    return Promise.all([
      steem.api.getRewardFundAsync('post'),
      steem.api.getCurrentMedianHistoryPriceAsync(),
      steem.api.getContentAsync(this.author, this.permlink),
      this.getFollowers(this.author),
      common.getUsername('st')
    ]).then((results) => {
      // set the reward balance and the recent claims
      this.rewardBalance = common.parsePayoutAmount(results[0].reward_balance)
      this.recentClaims = common.parsePayoutAmount(results[0].recent_claims)
      this.followers = results[3]
      this.followersCount = results[3].length

      // set the steem price
      this.steemPrice = common.parsePayoutAmount(results[1].base) / common.parsePayoutAmount(results[1].quote)

      // set the post data
      this.post = results[2]

      // set the username
      this.username = results[4]

      // get the content replies
      return this.getContentRepliesAsync(this.author, this.permlink)
    }).then((replies) => {
      this.post.replies = replies
      common.init(this)
      console.log(this)
    }).catch(err => {
      console.error('An error occured while retrieving the data', err)
    })
  }

  loadWatchUI () {
    this.youtubeVideoId = this.getYoutubeVideoIdFromUrl(window.location.toString())
    this.isContentSteemified(this.youtubeVideoId)
      .then(resp => {
        if (resp === false) {
          common.init(this)
          let uploadBtn = new UploadButton('#end', this)
          uploadBtn.load().then(() => {
            this.registerSteemifierComponent(uploadBtn)
          })
        } else {
          this.loadDataWatchUI().then(() => {
            let author = new Author('#owner-name', this)
            author.load().then(() => {
              this.registerSteemifierComponent(author)
            })

            let followBtn = new FollowButton('#top-row', this)
            followBtn.load().then(() => {
              this.registerSteemifierComponent(followBtn)
            })

            let counters = new Counters('yt-view-count-renderer', this)
            counters.load().then(() => {
              this.registerSteemifierComponent(counters)
            })

            let comments = new Comments('ytd-comments', this)

            if (jQuery(comments.id).val() !== undefined) {
              comments.displaySteemCommentsBox()
            } else {
              comments.load()
            }
          })
        }
      })
  }

  getYoutubeVideoIdFromUrl (url) {
    let regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    let match = url.match(regExp)
    if (match && match[2].length === 11) {
      return match[2]
    }
  }

  loadPage () {
    this.removeSteemifierModules()
    if (pagePath === '/watch') {
      this.loadWatchUI()
    }
  }

  registerSteemifierComponent (component) {
    jQuery(component.id).addClass('steemifier')
    this.components.push(component.id)
  }

  removeSteemifierModules (component) {
    while (this.components.length) {
      let component = this.components.shift()
      jQuery(component).remove()
    }
  }
}

const listenPageNavigation = () => {
  setInterval(() => {
    pagePath = window.location.pathname
    // if the href changes, we load the appropriate UI
    if (pageHref !== window.location.href) {
      pageHref = window.location.href
      steemifier.loadPage()
    }
  }, 1000)
}

var steemifier = new Steemifier()
steemifier.loadPage()
listenPageNavigation()
