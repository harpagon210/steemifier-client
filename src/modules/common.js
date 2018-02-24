import jQuery from 'jquery'
import Noty from 'noty'
import moment from 'moment-timezone'
import showdown from 'showdown'
import base58 from 'bs58'
import getSlug from 'speakingurl'
import secureRandom from 'secure-random'
import sanitizeHtml from 'sanitize-html'

var dataModule = null
var votesLoading = false
var converter = new showdown.Converter({'simpleLineBreaks': true})
moment.tz.setDefault('Europe/London')

var port = chrome.runtime.connect() // eslint-disable-line no-undef
var promises = []

class Deferred {
  constructor () {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject
      this.resolve = resolve
    })
  }
}

export const postMessage = (request) => {
  const id = base58.encode(secureRandom.randomBuffer(4))
  const defered = new Deferred()

  port.postMessage({
    'id': id,
    'action': request.action,
    'params': request.params
  })

  promises.push({
    'id': id,
    'promise': defered
  })

  return defered.promise
}

export const init = (dataMod) => {
  dataModule = dataMod
}

port.onMessage.addListener((request) => {
  const index = promises.findIndex(promise => promise.id === request.id)
  console.log(request)
  if (index > -1) {
    if (request.resp && (request.resp.login || request.resp.logout)) {
      if (chrome.tabs) { // eslint-disable-line no-undef
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => { // eslint-disable-line no-undef
          chrome.tabs.sendMessage(tabs[0].id, {'type': 'refresh'}, (response) => { // eslint-disable-line no-undef

          })
        })
      } else {
        if (dataModule) {
          dataModule.loadPage()
        }
      }
    } else {
      promises[index].promise.resolve(request.resp)
    }

    promises.splice(index, 1)
  }
})

chrome.runtime.onMessage.addListener(request => { // eslint-disable-line no-undef
  if (request.type && request.type === 'refresh') {
    if (dataModule) {
      dataModule.loadPage()
    }
  }
})

export const addListenerFollowButton = () => {
  jQuery(document).off('click', '.steemifier #follow-btn').on('click', '.steemifier #follow-btn', (event) => {
    let btn = jQuery(event.currentTarget)
    btn.addClass('is-loading')
    const author = btn.data('author')
    const follow = !btn.hasClass('following')

    const params = {
      'author': author,
      'follow': follow
    }

    postMessage({
      'action': 'follow',
      'params': params
    }).then(resp => {
      btn.removeClass('is-loading')

      let type = ''
      let message = ''
      if (resp.err !== undefined) {
        type = 'error'
        message = 'An error occured while trying to follow/unfollow!'
        console.error(resp.err)
      } else {
        type = 'success'
        message = follow ? `You are now following ${author}!` : `You stopped following ${author}!`

        if (follow) {
          btn.addClass('following')
          dataModule.followersCount++
          btn.text(`UNFOLLOW ${dataModule.followersCount}`)
        } else {
          btn.removeClass('following')
          dataModule.followersCount--
          btn.text(`FOLLOW ${dataModule.followersCount}`)
        }
      }

      new Noty({
        type: type,
        theme: 'steemifier',
        text: message,
        layout: 'bottomRight',
        timeout: '4000'
      }).show()

      jQuery('#vote-modal').removeClass('is-active')
    })
  })
}

export const addListenerCommentButton = () => {
  jQuery(document).off('click', '.steemifier .comment-button').on('click', '.steemifier .comment-button', (event) => {
    let btn = jQuery(event.currentTarget)
    btn.addClass('is-loading')
    let author = btn.data('author')
    let permlink = btn.data('permlink')
    let parentAuthor = btn.data('parent-author')
    let parentPermlink = btn.data('parent-permlink')
    let action = btn.data('action')

    let message = btn.closest('.media-content').find('.textarea').val()

    if (message.trim() === '') {
      btn.removeClass('is-loading')
      return
    }

    const params = {
      'author': author,
      'permlink': permlink,
      'parentAuthor': parentAuthor,
      'parentPermlink': parentPermlink,
      'message': message,
      'action': action,
      'tags': [dataModule.post.category]
    }

    postMessage({
      'action': 'comment',
      'params': params
    }).then(resp => {
      if (resp.err !== undefined) {
        btn.removeClass('is-loading')
        let type = 'error'
        let message = 'An error occured while trying to post/edit the comment!'
        console.error(resp.err)
        new Noty({
          type: type,
          theme: 'steemifier',
          text: message,
          layout: 'bottomRight',
          timeout: '4000'
        }).show()
      } else {
        if (action === 'post') {
          let permlinkComment = resp.permlink
          let authorComment = resp.author

          let isCommentOriginalPost = dataModule.post.author === author && dataModule.post.permlink === permlink

          let newComment = `
            <article class="media comment" data-author="${authorComment}" data-permlink="${permlinkComment}">
              <figure class="media-left">
                  <a target="_blank" href="https://busy.org/@${authorComment}">
                      <p class="image">
                          <img class="avatar-rounded" style="min-width: 40px; width: 40px; height: 40px;" src="https://steemitimages.com/u/${authorComment}/avatar/small">
                      </p>
                  </a>
              </figure>
              <div class="media-content">
                  <div class="content">
                      <p>
                          <a target="_blank" href="https://busy.org/@${authorComment}">
                              <strong>${authorComment}</strong>
                          </a>
                          <small>${moment(new Date(), 'YYYY-MM-DDTHH:mm:ss').fromNow()}</small>
                          <br> 
                          <div class="comment-body">${parseContent(message)}</div>
                          <div class="comment-body-hidden" style="display:none;">${message}</div>
                          <br>
                          <small>
                              <span class="vote-button" data-author="${authorComment}" data-permlink="${permlinkComment}">
                                  ${svgLike('15px')}
                              </span>
                              <span class="has-text-primary steemifier-tooltip vote-list-button" data-author="${authorComment}" data-permlink="${permlinkComment}">
                                  0
                                  <span class="steemifier-tooltip-wrapper">
                                      <span class="steemifier-tooltiptext" style="width: 100px"></span>
                                  </span>
                              </span> · $0 · 
                              <a class="reply-comment">Reply</a>
                              · <a class="edit-comment" data-parent-author="${author}" data-parent-permlink="${permlink}">Edit</a>
                          </small>
                      </p>
                  </div>
            </article>`

          let newContent = ''
          if (!isCommentOriginalPost) {
            newContent = newComment
          } else {
            newContent = replyBoxString(author, permlink, '', '', 'post', true) + newComment
          }

          let btn = jQuery(`.comment-button[data-author='${author}'][data-permlink='${permlink}']`)
          btn.closest('article').replaceWith(newContent)

          addListenerReplyButton()
          addListenerEditButton()
          addListenerVoteButton()
          addListenerSubmitVoteButton()
          addListenerVoteListButton()
          addListenerCommentButton()
        } else {
          let commentBody = btn.closest('.comment-body')
          commentBody.html(parseContent(message))
          commentBody.siblings('.comment-body-hidden').first().text(message)
          btn.closest('.reply-box').remove()
        }
      }
    })
  })
}

export const addListenerReplyButton = () => {
  jQuery(document).off('click', '.steemifier .reply-comment').on('click', '.steemifier .reply-comment', (event) => {
    const link = jQuery(event.currentTarget)
    const commentArticle = link.closest('article')
    const childArticle = commentArticle.find('article.reply-box')

    if (childArticle.val() === undefined) {
      const author = commentArticle.data('author')
      const permlink = commentArticle.data('permlink')
      const commentTargetDisply = link.closest('.content')

      displayReplyBox(commentTargetDisply, author, permlink)
    } else {
      childArticle.remove()
    }
  })
}

export const addListenerEditButton = () => {
  jQuery(document).off('click', '.steemifier .edit-comment').on('click', '.steemifier .edit-comment', (event) => {
    const link = jQuery(event.currentTarget)
    const commentArticle = link.closest('article')
    const commentBody = commentArticle.find('.comment-body').first()
    const commentBodyHidden = commentArticle.find('.comment-body-hidden').first()
    const bodyContentHidden = commentBodyHidden.text()
    const author = commentArticle.data('author')
    const permlink = commentArticle.data('permlink')
    const parentAuthor = link.data('parent-author')
    const parentPermlink = link.data('parent-permlink')

    displayReplyBox(commentBody, author, permlink, parentAuthor, parentPermlink, 'edit')

    commentBody.find('.reply-box textarea').val(bodyContentHidden)
  })
}

export const addListenerCancelEditButton = () => {
  jQuery(document).off('click', '.steemifier .cancel-edit-button').on('click', '.steemifier .cancel-edit-button', (event) => {
    const btn = jQuery(event.currentTarget)
    btn.closest('.reply-box').remove()
  })
}

export const displayReplyBox = (commentTargetDisply, author, permlink, parentAuthor = '', parentPermlink = '', type = 'post', isMain = false) => {
  commentTargetDisply.append(replyBoxString(author, permlink, parentAuthor, parentPermlink, type, isMain))

  if (!isMain) {
    focusReplyBox(author, permlink)
  }

  addListenerCommentButton()
  addListenerCancelEditButton()
}

const focusReplyBox = (author, permlink) => {
  let btn = jQuery(`.comment-button[data-author='${author}'][data-permlink='${permlink}']`)
  btn.closest('.media-content').find('.textarea').focus()
}

const replyBoxString = (author, permlink, parentAuthor, parentPermlink, type = 'post', isMain = false) => {
  let btnLabel = type === 'edit' ? 'Edit comment' : 'Post comment'
  let btnCancel = type === 'edit' ? '<button class="button cancel-edit-button">cancel</button>' : ''

  return `
  <article class="media reply-box">
    <div class="media-content">
      <div class="field" style="max-width:96%">
        <p class="control">
          <textarea class="textarea" style="min-height:80px" placeholder="Add a comment..."></textarea>
        </p>
      </div>
      <div class="field">
        <p class="control">
          <button class="button is-primary comment-button ${isMain ? 'is-size-5' : ''}" data-author="${author}" data-permlink="${permlink}" data-parent-author="${parentAuthor}" data-parent-permlink="${parentPermlink}" data-action="${type}">${btnLabel}</button>
          ${btnCancel}
        </p>
      </div>
      ${isMain ? `<a class="steemifier-comments-order" orderBy="best">Best</a> ·  <a class="steemifier-comments-order" orderBy="newest">Newest</a> · <a class="steemifier-comments-order" orderBy="oldest">Oldest</a>` : ''}
    </div>
  </article>
`
}

export const addListenerVoteButton = () => {
  jQuery(document).off('click', '.steemifier .vote-button').on('click', '.steemifier .vote-button', (event) => {
    let btn = jQuery(event.currentTarget)
    let author = btn.data('author')
    let permlink = btn.data('permlink')
    let voteSubmitBtn = jQuery('.steemifier #vote-submit')
    voteSubmitBtn.data('author', author)
    voteSubmitBtn.data('permlink', permlink)
    jQuery('.steemifier #vote-modal .vote-modal-content').addClass('is-invisible')
    jQuery('.steemifier #vote-modal').addClass('is-active')
    let modalCardBody = jQuery('.steemifier #vote-modal .modal-card-body')
    modalCardBody.addClass('element is-loading')

    postMessage({'action': 'getSteemAccountInfo'}).then(resp => {
      jQuery('.steemifier #vote-modal .modal-card-body').removeClass('element is-loading')
      jQuery('.steemifier #vote-modal .vote-modal-content').removeClass('is-invisible')

      let type = ''
      let message = ''
      if (resp.err !== undefined) {
        type = 'error'
        message = resp.err

        new Noty({
          type: type,
          theme: 'steemifier',
          text: message,
          layout: 'bottomRight',
          timeout: '4000'
        }).show()
      } else {
        dataModule.userAccount = resp.res
        let modalCardBody = jQuery('.steemifier #vote-modal .modal-card-body')
        modalCardBody.find('.voting-power').text('Voting Power: ' + dataModule.userAccount.calculatedVotingPower + '%')
        jQuery('#vote-weight-slider').val(dataModule.userAccount.votingWeight)
        modalCardBody.find('.vote-weight').text('Vote Weight: ' + dataModule.userAccount.votingWeight + '%')
        modalCardBody.find('.vote-value').text('Vote value: $' + (calculateVoteValue(dataModule.userAccount.vestsPerVote, dataModule.userAccount.calculatedVotingPower, dataModule.userAccount.votingWeight)).toFixed(3))
      }
    })
  })
}

export const calculateVoteValue = (vests, vp = 100.00, weight = 100.00) => {
  vp = vp * 100
  weight = weight * 100
  const vestingShares = parseInt(vests * 1e6, 10)
  const power = vp * weight / 10000 / 50
  const rshares = power * vestingShares / 10000
  return rshares / dataModule.recentClaims * dataModule.rewardBalance * dataModule.steemPrice
}

export const addListenerSubmitVoteButton = () => {
  jQuery(document).off('click', '.steemifier #vote-submit').on('click', '.steemifier #vote-submit', (event) => {
    let btn = jQuery(event.currentTarget)
    btn.addClass('is-loading')
    const author = btn.data('author')
    const permlink = btn.data('permlink')
    const voteWeight = jQuery('#vote-weight-slider').val()

    const params = {
      'author': author,
      'permlink': permlink,
      'voteWeight': voteWeight
    }

    postMessage({
      'action': 'upvote',
      'params': params
    }).then(resp => {
      jQuery('.steemifier #vote-submit').removeClass('is-loading')

      let type = ''
      let message = ''
      if (resp.err !== undefined) {
        type = 'error'
        message = 'An error occured while trying to upvote!'
        console.error(resp.err)
      } else {
        type = 'success'
        message = `Successfully upvoted at ${voteWeight}%!`

        let voteBtn = jQuery(`.vote-button[data-author='${author}'][data-permlink='${permlink}']`)

        if (!voteBtn.hasClass('upvoted')) {
          let voteCounter = voteBtn.siblings('.vote-list-button').find('.vote-counter')
          let nbVotes = parseInt(voteCounter.text()) + 1
          voteCounter.text(nbVotes)
          voteBtn.addClass('upvoted')
        }
      }

      new Noty({
        type: type,
        theme: 'steemifier',
        text: message,
        layout: 'bottomRight',
        timeout: '4000'
      }).show()

      jQuery('#vote-modal').removeClass('is-active')
    })
  })

  jQuery('.vote-button').not('.upvoted').hover((event) => {
    let btn = jQuery(event.currentTarget)
    btn.addClass('vote-button-hover')
  }, (event) => {
    let btn = jQuery(event.currentTarget)
    btn.removeClass('vote-button-hover')
  })
}

export const parsePayoutAmount = amount => {
  return parseFloat(String(amount).replace(/\s[A-Z]*$/, ''))
}

export const calculatePayout = post => {
  const payoutDetails = {}
  const activeVotes = post.active_votes
  const parentAuthor = post.parent_author
  const cashoutTime = post.cashout_time
  const lastPayoutTime = post.last_payout
  const maxPayout = parsePayoutAmount(post.max_accepted_payout)
  const pendingPayout = parsePayoutAmount(post.pending_payout_value)
  const promoted = parsePayoutAmount(post.promoted)
  const totalAuthorPayout = parsePayoutAmount(post.total_payout_value)
  const totalCuratorPayout = parsePayoutAmount(post.curator_payout_value)
  const isComment = parentAuthor !== ''

  let payout = pendingPayout + totalAuthorPayout + totalCuratorPayout
  if (payout < 0.0) payout = 0.0
  if (payout > maxPayout) payout = maxPayout
  payoutDetails.payoutLimitHit = payout >= maxPayout

  // There is an "active cashout" if: (a) there is a pending payout, OR (b)
  // there is a valid cashout time AND it's NOT a comment with 0 votes.
  const cashoutActive =
    pendingPayout > 0 ||
    (cashoutTime.indexOf('1969') !== 0 && !(isComment && activeVotes.length === 0))

  if (cashoutActive) {
    payoutDetails.potentialPayout = pendingPayout
  }

  if (promoted > 0) {
    payoutDetails.promotionCost = promoted
  }

  if (cashoutActive) {
    // Append ".000Z" to make it ISO format (YYYY-MM-DDTHH:mm:ss.sssZ).
    payoutDetails.cashoutInTime = cashoutTime + '.000Z'
  }

  if (maxPayout === 0) {
    payoutDetails.isPayoutDeclined = true
  } else if (maxPayout < 1000000) {
    payoutDetails.maxAcceptedPayout = maxPayout
  }

  if (totalAuthorPayout > 0) {
    payoutDetails.pastPayouts = totalAuthorPayout + totalCuratorPayout
    payoutDetails.authorPayouts = totalAuthorPayout
    payoutDetails.curatorPayouts = totalCuratorPayout
    payoutDetails.lastPayoutTime = lastPayoutTime + '.000Z'
  }

  return payoutDetails
}

export const orderVotes = (votes) => {
  // process the votes (order by pending payout and only the first ten)
  if (votes.length > 1) {
    votes.sort((a, b) => {
      let votePriceA = calculatePendingPayout(a.rshares)
      a.votePrice = votePriceA.toFixed(3)
      let votePriceB = calculatePendingPayout(b.rshares)
      b.votePrice = votePriceB.toFixed(3)
      return votePriceA > votePriceB ? -1 : votePriceA < votePriceB ? 1 : 0
    })
  } else if (votes.length > 0) {
    votes[0].votePrice = calculatePendingPayout(votes[0].rshares).toFixed(3)
  }
}

export const displayVotesTooltip = (votes) => {
  orderVotes(votes)

  let votesRendererTooltip = ''
  let maxVotes = 10
  let voteDisplayed = maxVotes
  for (const vote of votes) {
    votesRendererTooltip += `<a target="_blank" href="https://busy.org/@${vote.voter}"><strong>${vote.voter}</strong> $${vote.votePrice}</a><br/>`

    voteDisplayed--
    if (voteDisplayed <= 0) {
      break
    }
  }

  if ((votes.length - maxVotes) > 0) {
    votesRendererTooltip += `<a class="vote-list-button">See ${votes.length - maxVotes} more...</a>`
  }

  return votesRendererTooltip
}

export const displayPayout = (post) => {
  let payoutDetails = calculatePayout(post)
  let resp = {}

  if (payoutDetails.payoutLimitHit) {
    resp.payoutInfo = `Payout limit is reached<br/>`
  }

  if (payoutDetails.cashoutInTime) {
    resp.payoutTitle = payoutDetails.potentialPayout.toFixed(3)
    resp.payoutInfo = `
      Pending payout: $${resp.payoutTitle} <br/>
      Will be released ${moment(payoutDetails.cashoutInTime, 'YYYY-MM-DDTHH:mm:ss').fromNow()}
    `
  } else if (payoutDetails.lastPayoutTime) {
    resp.payoutTitle = payoutDetails.pastPayouts.toFixed(3)
    resp.payoutInfo = `
      Total past payouts: $${payoutDetails.pastPayouts.toFixed(3)} <br/>
      Author payout: $${payoutDetails.authorPayouts.toFixed(3)} <br/>
      Curator payout: $${payoutDetails.curatorPayouts.toFixed(3)} <br/>
      Released ${moment(payoutDetails.lastPayoutTime, 'YYYY-MM-DDTHH:mm:ss').fromNow()}
    `
  } else {
    resp.payoutTitle = '0'
    resp.payoutInfo = ''
  }

  if (payoutDetails.promotionCost > 0) {
    resp.payoutInfo = `<br>Promoted: $${payoutDetails.promotionCost}`
  }

  return resp
}

const calculatePendingPayout = (rshares) => {
  return rshares * dataModule.rewardBalance / dataModule.recentClaims * dataModule.steemPrice
}

export const hasUserUpvotedPost = (votes) => {
  return new Promise(resolve => {
    if (dataModule.username) {
      const users = votes.filter(el => el.voter === dataModule.username)
      if (users.length === 1) {
        resolve(true)
      }
    }

    resolve(false)
  })
}

export const addListenerVoteListButton = () => {
  jQuery('#vote-weight-slider').bind('input', (event) => {
    let target = jQuery(event.currentTarget)
    let val = target.val()
    target.siblings('.vote-weight').text('Vote Weight: ' + val + '%')
    target.siblings('.vote-value').text('Vote value: $' + (calculateVoteValue(dataModule.userAccount.vestsPerVote, dataModule.userAccount.calculatedVotingPower, val)).toFixed(3))
  })

  jQuery(document).off('click', '.steemifier .vote-modal-close').on('click', '.steemifier .vote-modal-close', () => {
    jQuery('.steemifier #vote-modal').removeClass('is-active')
  })

  jQuery(document).off('click', '.steemifier .vote-list-button').on('click', '.steemifier .vote-list-button', async (event) => {
    jQuery('.steemifier #list-vote-modal').empty()
    jQuery('.steemifier #display-vote-modal').addClass('is-active')
    let modalCardBody = jQuery('.steemifier #display-vote-modal .modal-card-body')
    modalCardBody.addClass('element is-loading')

    let btn = jQuery(event.currentTarget)
    const author = btn.data('author')
    const permlink = btn.data('permlink')

    const votes = await dataModule.getActiveVotesAsync(author, permlink)
    orderVotes(votes)

    jQuery('.steemifier #display-vote-modal .modal-card-body').scroll(() => {
      if (votesLoading) {
        return
      }
      const target = jQuery('.steemifier #display-vote-modal .modal-card-body')
      let position = target.scrollTop()
      let tableHeight = jQuery('.steemifier #display-vote-modal .modal-card-body table').height()
      let modalHeight = jQuery('.steemifier #display-vote-modal .modal-card-body').height() + 10 // adding 10px to the modal height because of an issue with getting the righ height on Firefox

      if ((position + modalHeight) >= tableHeight) {
        const lastTr = jQuery('.steemifier #display-vote-modal .modal-card-body table tr:last')
        const index = lastTr.data('index')
        loadVotesModal(index, votes)
      }
    })

    // load votes until the the modal is full
    let target = jQuery('.steemifier #display-vote-modal .modal-card-body')
    let tableHeight = null
    let lastTr = null
    let index = -1
    let modalHeight = null

    do {
      loadVotesModal(index, votes)
      lastTr = jQuery('.steemifier #display-vote-modal .modal-card-body table tr:last')
      index = lastTr.val() === undefined ? -1 : lastTr.data('index')
      tableHeight = jQuery('.steemifier #display-vote-modal .modal-card-body table').height()
      modalHeight = target.height()
    } while (tableHeight < modalHeight && index > -1 && (index < votes.length - 1))

    modalCardBody.removeClass('element is-loading')
  })

  jQuery(document).off('click', '.steemifier .display-vote-modal-close').on('click', '.steemifier .display-vote-modal-close', () => {
    jQuery('.steemifier #display-vote-modal').removeClass('is-active')
  })
}

const loadVotesModal = (startingIndex, votes) => {
  votesLoading = true
  let target = jQuery('.steemifier #list-vote-modal')
  let maxVotesPerLoad = 10
  let votesArraySize = votes.length

  // load vote only if it exists
  for (let i = startingIndex + 1; (i <= startingIndex + maxVotesPerLoad) && (i < votesArraySize); i++) {
    displayVote(target, votes[i], i)
  }

  votesLoading = false
}

const displayVote = (target, vote, index) => {
  let voteRendererModal = `
    <tr data-index="${index}">
      <td>
        <span class="image">
          <img class="avatar-rounded" style="min-width: 24px; width: 24px; height: 24px;" src="https://steemitimages.com/u/${vote.voter}/avatar/small">
        </span>
      </td>
      <td>
        <a target="_blank" href="https://busy.org/@${vote.voter}">${vote.voter}</a>
      </td>
      <td>
        $${vote.votePrice}
      </td>
      <td>
        ${vote.percent / 100}%
      </td>
    </tr>
  `
  target.append(voteRendererModal)
}

export const getUsername = (type) => {
  return postMessage({
    'action': 'getUsername',
    'params': type
  })
}

export const login = (type) => {
  postMessage({
    'action': 'login',
    'params': type
  }).then(resp => {
    let typeMsg = ''
    let message = ''
    if (resp.err !== undefined) {
      typeMsg = 'error'
      message = resp.err
    } else {
      typeMsg = 'success'
      message = `Successfully logged in!`
    }

    new Noty({
      type: typeMsg,
      theme: 'steemifier',
      text: message,
      layout: 'bottomRight',
      timeout: '4000'
    }).show()
  })
}

export const logout = (type) => {
  postMessage({
    'action': 'logout',
    'params': type
  }).then(resp => {
    let typeMessage = ''
    let message = ''
    if (resp.err !== undefined) {
      typeMessage = 'error'
      message = resp.err
    } else {
      typeMessage = 'success'
      message = `Successfully logged out!`
    }

    new Noty({
      type: typeMessage,
      theme: 'steemifier',
      text: message,
      layout: 'bottomRight',
      timeout: '4000'
    }).show()
  })
}

export const addContent = () => {
  return postMessage({
    'action': 'addContent',
    'params': {
      'contentId': dataModule.youtubeVideoId
    }
  })
}

export const svgLike = (size) => {
  return `
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Capa_1" x="0px" y="0px" width="${size}" height="${size}" viewBox="0 0 456.814 456.814" style="enable-background:new 0 0 456.814 456.814;" xml:space="preserve">
      <g>
        <g>
          <path d="M441.11,252.677c10.468-11.99,15.704-26.169,15.704-42.54c0-14.846-5.432-27.692-16.259-38.547    c-10.849-10.854-23.695-16.278-38.541-16.278h-79.082c0.76-2.664,1.522-4.948,2.282-6.851c0.753-1.903,1.811-3.999,3.138-6.283    c1.328-2.285,2.283-3.999,2.852-5.139c3.425-6.468,6.047-11.801,7.857-15.985c1.807-4.192,3.606-9.9,5.42-17.133    c1.811-7.229,2.711-14.465,2.711-21.698c0-4.566-0.055-8.281-0.145-11.134c-0.089-2.855-0.574-7.139-1.423-12.85    c-0.862-5.708-2.006-10.467-3.43-14.272c-1.43-3.806-3.716-8.092-6.851-12.847c-3.142-4.764-6.947-8.613-11.424-11.565    c-4.476-2.95-10.184-5.424-17.131-7.421c-6.954-1.999-14.801-2.998-23.562-2.998c-4.948,0-9.227,1.809-12.847,5.426    c-3.806,3.806-7.047,8.564-9.709,14.272c-2.666,5.711-4.523,10.66-5.571,14.849c-1.047,4.187-2.238,9.994-3.565,17.415    c-1.719,7.998-2.998,13.752-3.86,17.273c-0.855,3.521-2.525,8.136-4.997,13.845c-2.477,5.713-5.424,10.278-8.851,13.706    c-6.28,6.28-15.891,17.701-28.837,34.259c-9.329,12.18-18.94,23.695-28.837,34.545c-9.899,10.852-17.131,16.466-21.698,16.847    c-4.755,0.38-8.848,2.331-12.275,5.854c-3.427,3.521-5.14,7.662-5.14,12.419v183.01c0,4.949,1.807,9.182,5.424,12.703    c3.615,3.525,7.898,5.38,12.847,5.571c6.661,0.191,21.698,4.374,45.111,12.566c14.654,4.941,26.12,8.706,34.4,11.272    c8.278,2.566,19.849,5.328,34.684,8.282c14.849,2.949,28.551,4.428,41.11,4.428h4.855h21.7h10.276    c25.321-0.38,44.061-7.806,56.247-22.268c11.036-13.135,15.697-30.361,13.99-51.679c7.422-7.042,12.565-15.984,15.416-26.836    c3.231-11.604,3.231-22.74,0-33.397c8.754-11.611,12.847-24.649,12.272-39.115C445.395,268.286,443.971,261.055,441.11,252.677z"/>
          <path d="M100.5,191.864H18.276c-4.952,0-9.235,1.809-12.851,5.426C1.809,200.905,0,205.188,0,210.137v182.732    c0,4.942,1.809,9.227,5.426,12.847c3.619,3.611,7.902,5.421,12.851,5.421H100.5c4.948,0,9.229-1.81,12.847-5.421    c3.616-3.62,5.424-7.904,5.424-12.847V210.137c0-4.949-1.809-9.231-5.424-12.847C109.73,193.672,105.449,191.864,100.5,191.864z     M67.665,369.308c-3.616,3.521-7.898,5.281-12.847,5.281c-5.14,0-9.471-1.76-12.99-5.281c-3.521-3.521-5.281-7.85-5.281-12.99    c0-4.948,1.759-9.232,5.281-12.847c3.52-3.617,7.85-5.428,12.99-5.428c4.949,0,9.231,1.811,12.847,5.428    c3.617,3.614,5.426,7.898,5.426,12.847C73.091,361.458,71.286,365.786,67.665,369.308z"/>
        </g>
      </g>
    </svg>
  `
}

const checkPermLinkLength = (permlink) => {
  if (permlink.length > 255) {
    permlink = permlink.substring(permlink.length - 255, permlink.length)
  }
  // only letters numbers and dashes shall survive
  permlink = permlink.toLowerCase().replace(/[^a-z0-9-]+/g, '')
  return permlink
}

const slug = (text) => {
  return getSlug(text.replace(/[<>]/g, ''), { truncate: 128 })
}

export const createPermlink = (title, author, parentAuthor, parentPermlink) => {
  let permlink
  // posts
  if (title && title.trim() !== '') {
    let s = slug(title)
    if (s === '') {
      s = base58.encode(secureRandom.randomBuffer(4))
    }

    let prefix = `-${base58.encode(secureRandom.randomBuffer(4))}`

    permlink = s + prefix

    return checkPermLinkLength(permlink)
  }

  // comments: re-parentauthor-parentpermlink-time
  const timeStr = new Date().toISOString().replace(/[^a-zA-Z0-9]+/g, '')
  parentPermlink = parentPermlink.replace(/(-\d{8}t\d{9}z)/g, '')
  permlink = `re-${parentAuthor}-${parentPermlink}-${timeStr}`
  return checkPermLinkLength(permlink)
}

export const parseContent = (content) => {
  let parsedContent = content
  // hashtag
  parsedContent = parsedContent.replace(/(^|\s)(#[-a-z\d]+)/gi, tag => {
    if (/#[\d]+$/.test(tag)) return tag // Don't allow numbers to be tags
    const space = /^\s/.test(tag) ? tag[0] : ''
    const tag2 = tag.trim().substring(1)
    const tagLower = tag2.toLowerCase()
    return `${space}<a target="_blank" href="https://busy.org/trending/${tagLower}">${tag.replace('#', '')}</a>`
  })

  // usertag (mention)
  parsedContent = parsedContent.replace(/(^|\s)(@[a-z][-.a-z\d]+[a-z\d])/gi, user => {
    const space = /^\s/.test(user) ? user[0] : ''
    const user2 = user.trim().substring(1)
    const userLower = user2.toLowerCase()
    const valid = validateAccountName(userLower) == null
    return space + (valid ? `<a target="_blank" href="https://busy.org/@${userLower}">@${user2}</a>` : `@${user2}`)
  })

  if (dataModule && dataModule.youtubeVideoId) {
    console.log(dataModule)
    // time
    let regExp = /\s(\d{1,2}:)?(\d{1,2}:)?(\d{2})\s/g

    let matches
    let time
    while ((matches = regExp.exec(content)) !== null) {
      time = ''
      // https://youtu.be/fpsUYq72Dls?t=2h44m34s
      if (matches[1]) {
        matches[1] = matches[1].replace(':', '')
      }
      if (matches[2]) {
        matches[2] = matches[2].replace(':', '')
      }

      time += matches[1] && matches[2] ? `${matches[1]}h${matches[2]}m` : ''
      time += matches[1] && matches[2] === undefined ? `${matches[1]}m` : ''
      time += matches[3] ? `${matches[3]}s` : ''

      let youtubeLink = ` <a href="https://youtu.be/${dataModule.youtubeVideoId}?t=${time}">${matches[0].trim()}</a> `
      parsedContent = parsedContent.replace(matches[0], youtubeLink)
    }
  }

  return sanitizeHtml(converter.makeHtml(parsedContent))
}

const validateAccountName = (value) => {
  let label
  let suffix

  suffix = 'Account name should '
  if (!value) {
    return `${suffix}not be empty.`
  }
  const length = value.length
  if (length < 3) {
    return `${suffix}be longer.`
  }
  if (length > 16) {
    return `${suffix}be shorter.`
  }
  if (/\./.test(value)) {
    suffix = 'Each account segment should '
  }
  const ref = value.split('.')
  for (let i = 0, len = ref.length; i < len; i += 1) {
    label = ref[i]
    if (!/^[a-z]/.test(label)) {
      return `${suffix}start with a letter.`
    }
    if (!/^[a-z0-9-]*$/.test(label)) {
      return `${suffix}have only letters, digits, or dashes.`
    }
    if (/--/.test(label)) {
      return `${suffix}have only one dash in a row.`
    }
    if (!/[a-z0-9]$/.test(label)) {
      return `${suffix}end with a letter or digit.`
    }
    if (!(label.length >= 3)) {
      return `${suffix}be longer`
    }
  }
  return null
}
