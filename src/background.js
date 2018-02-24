import * as sc2 from 'sc2-sdk'
import * as common from './modules/common'
import PackageInfo from '../package.json'

var actions = {}

const appId = `steemifier/${PackageInfo.version}`

chrome.runtime.onConnect.addListener((port) => { // eslint-disable-line no-undef
  port.onMessage.addListener((request) => {
    console.log(request.action + ' started')
    actions[request.action](request.params).then((resp) => {
      request.resp = resp
      console.log(request)
      console.log(request.action + ' resolved')
      port.postMessage(request)
    })
  })
})

const getVotingWeight = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['st_voting_weight'], (items) => { // eslint-disable-line no-undef
      if (items.st_voting_weight === undefined) {
        chrome.storage.local.set({'st_voting_weight': 100.00}) // eslint-disable-line no-undef
        resolve(100.00)
      } else {
        resolve(items.st_voting_weight)
      }
    })
  })
}

const getSteemAccountInfo = (params) => {
  return new Promise((resolve) => {
    getAccessToken('st').then((res) => {
      console.log(res)

      if (res.err === undefined) {
        sc2Api.setAccessToken(res.res)
        sc2Api.me((err, resp) => {
          console.log(err, resp)
          let ret = {}
          if (err === null) {
            ret.res = resp
            if (res.login) {
              ret.login = true
            }

            // voting power calculation
            let vpow = calculateVotingPower(resp.account)

            ret.res.calculatedVotingPower = vpow

            // vote value calculation
            let vestingShares = parseFloat(resp.account.vesting_shares.replace(' VESTS', ''))
            let receivedVestingShares = parseFloat(resp.account.received_vesting_shares.replace(' VESTS', ''))
            let delegatedVestingShares = parseFloat(resp.account.delegated_vesting_shares.replace(' VESTS', ''))
            let userVests = vestingShares + receivedVestingShares - delegatedVestingShares
            console.log('userVests: ' + userVests)
            ret.res.vestsPerVote = userVests

            // retrieve voting weight
            getVotingWeight().then((weight) => {
              ret.res.votingWeight = weight
              resolve(ret)
            })
          } else {
            ret.err = err
            resolve(ret)
          }
        })
      } else {
        resolve(res)
      }
    })
  })
}

const calculateVotingPower = account => {
  const secondsago = (new Date() - new Date(account.last_vote_time + 'Z')) / 1000
  const vpow = account.voting_power + (10000 * secondsago / 432000)
  return Math.min(vpow / 100, 100).toFixed(2)
}

const upvote = (params) => {
  return new Promise((resolve) => {
    getAccessToken('st').then((res) => {
      let ret = {}

      if (res.err === undefined) {
        if (res.login) {
          ret.login = true
        }
        getUsername('st').then((username) => {
          sc2Api.setAccessToken(res.res)
          res.permlink = common.createPermlink('', username, params.author, params.permlink)
          res.author = username
          const voteWeight = parseFloat(params.voteWeight) * 100
          sc2Api.vote(username, params.author, params.permlink, voteWeight, (err, res) => {
            console.log(err, res)
            if (err) {
              ret.err = err
            } else {
              ret.res = res
            }

            resolve(ret)
          })
        })
      } else {
        resolve(res)
      }
    })
  })
}

const follow = (params) => {
  return new Promise((resolve) => {
    getAccessToken('st').then((res) => {
      let ret = {}

      if (res.err === undefined) {
        if (res.login) {
          ret.login = true
        }
        getUsername('st').then((username) => {
          sc2Api.setAccessToken(res.res)

          if (params.follow === true) {
            sc2Api.follow(username, params.author, (err, res) => {
              console.log(err, res)
              if (err) {
                ret.err = err
              } else {
                ret.res = res
              }

              resolve(ret)
            })
          } else {
            sc2Api.unfollow(username, params.author, (err, res) => {
              console.log(err, res)
              if (err) {
                ret.err = err
              } else {
                ret.res = res
              }

              resolve(ret)
            })
          }
        })
      } else {
        resolve(res)
      }
    })
  })
}

const comment = (params) => {
  return new Promise((resolve) => {
    getAccessToken('st').then((res) => {
      if (res.err === undefined) {
        let ret = {}
        if (res.login) {
          ret.login = true
        }
        getUsername('st').then((username) => {
          const jsonMetadata = {
            'tags': params.tags,
            'app': appId
          }
          sc2Api.setAccessToken(res.res)
          let permlink = ''
          if (params.action === 'edit') {
            permlink = params.permlink
            params.author = params.parentAuthor
            params.permlink = params.parentPermlink
          } else {
            permlink = common.createPermlink('', username, params.author, params.permlink)
          }

          sc2Api.comment(params.author, params.permlink, username, permlink, '', params.message, jsonMetadata, (err, res) => {
            console.log(err, res)
            if (err) {
              ret.err = err
            } else {
              ret.res = res
            }

            ret.permlink = permlink
            ret.author = username

            resolve(ret)
          })
        })
      } else {
        resolve(res)
      }
    })
  })
}

const login = (type) => { // eslint-disable-line no-unused-vars
  return new Promise((resolve) => {
    getAccessToken(type).then((res) => {
      console.log(res)
      let resp = {
        'login': true
      }
      resolve(resp)
    })
  })
}

const cleanStorage = (type) => {
  const keyTkn = type + '_token'
  const keyExpDt = type + '_exp_date'
  const keyUsr = type + '_usr'

  chrome.storage.local.remove([keyTkn, keyExpDt, keyUsr], () => { // eslint-disable-line no-undef
    // console.log('steem_token removed')
  })
}

const revokeAccessToken = type => {
  if (type) {
    getAccessToken(type).then((res) => {
      if (res.err === undefined && type === 'st') {
        sc2Api.setAccessToken(res.res)
        sc2Api.revokeToken((err, res) => {
          console.log(err, res)
          console.log('steem token revoked')
        })
      }
    })
  } else {
    revokeAccessToken('st')
    // revokeAccessToken('yt')
  }
}

const logout = (type) => {
  return new Promise((resolve) => {
    if (type) {
      const keyTkn = type + '_token'
      const keyExpDt = type + '_exp_date'
      const keyUsr = type + '_usr'

      revokeAccessToken(type)

      chrome.storage.local.remove([keyTkn, keyExpDt, keyUsr], () => { // eslint-disable-line no-undef
        // console.log('steem_token removed')
      })
    } else {
      revokeAccessToken()
      chrome.storage.local.clear() // eslint-disable-line no-undef
    }
    let resp = {
      'logout': true
    }
    resolve(resp)
  })
}

const getUsername = (type) => {
  return new Promise((resolve) => {
    const keyUsr = type + '_usr'

    chrome.storage.local.get([keyUsr], (items) => { // eslint-disable-line no-undef
      resolve(items[keyUsr])
    })
  })
}

const getAccessTokens = (types) => {
  return new Promise((resolve) => {
    let promises = []
    for (let i = 0; i < types.length; i++) {
      promises.push(getAccessToken(types[i]))
    }

    Promise.all(promises)
      .then(results => {
        console.log(results)
        let ret = {}
        ret.response = {}
        for (let i = 0; i < types.length; i++) {
          ret.response[types[i]] = results[i].res
        }
        resolve(ret)
      })
  })
}

const getAccessToken = (type) => {
  return new Promise((resolve) => {
    let token = null
    let resp = {}
    const keyTkn = type + '_token'
    const keyExpDt = type + '_exp_date'
    const keyUsr = type + '_usr'

    chrome.storage.local.get([keyTkn, keyExpDt], (items) => { // eslint-disable-line no-undef
      if (items[keyTkn] !== undefined) {
        // check that the expiration time has not been reached yet
        if (items[keyExpDt] >= new Date()) {
          token = items[keyTkn]
        } else {
          cleanStorage(type)
        }
      }

      if (token === null) {
        intitiateoAuthFlow(type).then((res) => {
          console.log(res)
          if (res.err === undefined) {
            // res: "https://olilghjgjdiehmlopegkloejkbcadioa.chromiumapp.org/steemconnect/?access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYXBwIiwicHJveHkiOiJhcHAtc3RlZW1pZnkiLCJ1c2VyIjoiaGFycGFnb24iLCJzY29wZSI6WyJ2b3RlIiwiY29tbWVudCJdLCJpYXQiOjE1MTY5MTgyOTEsImV4cCI6MTUxNzUyMzA5MX0.dPMofVHBVDjoQGf2rHj1o2DesxwyQEeg2U5Js6hwG04&expires_in=604800&username=harpagon"
            // res: "https://olilghjgjdiehmlopegkloejkbcadioa.chromiumapp.org/youtubeconnect/#access_token=ya29.GltYBQkdoqTAAFgWJu9mbhdqPAAG8YyZnhgDZ2brWKos3QO0zidPUgn_YRRk7OtVYjtvbOTZGMqtpoMbULgAK36lJlz7RXzS9_fjMjo_kK2TbprGZr6ni7LCR5Ka&token_type=Bearer&expires_in=3600"
            let resTab = type === 'yt' ? res.res.split('#')[1].split('&') : res.res.split('?')[1].split('&')
            token = resTab.filter((el) => {
              if (el.match('access_token') !== null) {
                return true
              }
            })[0].split('=')[1]

            let expTime = resTab.filter((el) => {
              if (el.match('expires_in') !== null) {
                return true
              }
            })[0].split('=')[1]

            let usr = ''

            if (type === 'st') {
              usr = resTab.filter((el) => {
                if (el.match('username') !== null) {
                  return true
                }
              })[0].split('=')[1]
            }

            let expDt = new Date()
            expDt = expDt.getTime() + (parseInt(expTime) * 1000)

            const params = {}
            params[keyTkn] = token
            params[keyExpDt] = expDt
            params[keyUsr] = usr

            // save token information
            chrome.storage.local.set(params) // eslint-disable-line no-undef

            resp.res = token
            resp.login = true
          } else {
            resp.err = res.err
          }
          resolve(resp)
        })
      } else {
        resp.res = token
        resolve(resp)
      }
    })
  })
}

const addContent = (params) => {
  return new Promise(resolve => {
    chrome.tabs.create({'url': `pages/add/index.html?id=${params.contentId}`}, tab => { // eslint-disable-line no-undef
      resolve({'response': 'ok'})
    })
  })
}

const intitiateoAuthFlow = (type) => {
  return new Promise((resolve) => {
    let url = ''

    switch (type) {
      case 'st':
        url = sc2Api.getLoginURL()
        break
      case 'yt':
        url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=916039289699-gds9u8p7vdm7uqhm47rl65tt45sva64o.apps.googleusercontent.com&redirect_uri=${chrome.identity.getRedirectURL()}youtubeconnect/&response_type=token&scope=https://www.googleapis.com/auth/youtube.readonly` // eslint-disable-line no-undef
        break
      default:
        break
    }

    chrome.identity.launchWebAuthFlow({ // eslint-disable-line no-undef
      'url': url,
      'interactive': true
    }, (redirectUri) => {
      let resp = {}
      if (chrome.runtime.lastError) { // eslint-disable-line no-undef
        resp.err = chrome.runtime.lastError.message // eslint-disable-line no-undef
      } else {
        resp.res = redirectUri
      }
      resolve(resp)
    })
  })
}

const init = () => {
  sc2Api = sc2.Initialize({
    app: process.env.SC2_APP_ID,
    callbackURL: chrome.identity.getRedirectURL() + 'steemconnect/', // eslint-disable-line no-undef
    accessToken: '',
    scope: ['vote', 'comment', 'custom_json']
  })
}

var sc2Api = null
actions = {
  'getSteemAccountInfo': getSteemAccountInfo,
  'upvote': upvote,
  'follow': follow,
  'comment': comment,
  'getUsername': getUsername,
  'logout': logout,
  'login': login,
  'addContent': addContent,
  'getAccessTokens': getAccessTokens
}
init()
console.log(chrome.identity.getRedirectURL()) // eslint-disable-line no-undef
chrome.storage.local.get(null, (items) => { // eslint-disable-line no-undef
  console.log(items)
})
