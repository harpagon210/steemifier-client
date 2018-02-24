import jQuery from 'jquery'
import moment from 'moment-timezone'
import * as common from './common'
import { Component } from './Component'

export default class Comments extends Component {
  constructor (target, datamodule) {
    super(target, datamodule)
    moment.tz.setDefault('Europe/London')
  }

  get id () {
    return '#steemifier-youtube-comments'
  }

  onLoaded () {
    this.commentsLoading = false
    return new Promise(resolve => {
      jQuery(this.target).wrap('<div id="steemifier-youtube-comments" class="comments-tab active-comments-tab" data-item="1"></div>')
      jQuery('#steemifier-youtube-comments').wrap('<div id="steemifier-comments-tabs"></div>')
      jQuery('#steemifier-comments-tabs').wrap('<div id="steemifier-comments" class="steemifier"></div>')
      jQuery('#steemifier-comments-tabs').append(`
        <div id="steemifier-steem-comments" class="comments-tab is-size-5" data-item="2">
          <div class="columns">
            <div id="steemifier-steem-comments-box" class="box column"></div>
          </div>
        </div`)
      jQuery('#steemifier-comments').prepend(`
      <div id="steemifier-comments-header" class="tabs has-text-weight-bold is-size-4">
          <ul>
              <li class="item is-active" data-option="1">
                  <a>Youtube comments</a>
              </li>
              <li class="item" data-option="2">
                  <a id="steemifier-comments-counter" class="has-text-primary">Steem comments</a>
              </li>
          </ul>
      </div>
      `)

      jQuery(document).off('click', '.steemifier #steemifier-comments-header ul li.item').on('click', '.steemifier #steemifier-comments-header ul li.item', (event) => {
        let target = event.currentTarget
        let number = jQuery(target).data('option')
        jQuery('#steemifier-comments-header ul li.item').removeClass('is-active')
        jQuery(target).addClass('is-active')
        jQuery('#steemifier-comments-tabs .comments-tab').removeClass('active-comments-tab')
        jQuery('div[data-item="' + number + '"]').addClass('active-comments-tab')
      })

      console.log('steemifier-comments-block loaded...')

      this.displaySteemCommentsBox('best')

      console.log(`${this.id} loaded`)
      resolve()
    })
  }

  displaySteemCommentsBox (orderBy = 'best') {
    let commentsBox = jQuery('#steemifier-steem-comments-box')
    commentsBox.empty()

    common.displayReplyBox(commentsBox, this.datamodule.post.author, this.datamodule.post.permlink, '', '', 'post', true)

    jQuery(document).off('click', '.steemifier .steemifier-comments-order').on('click', '.steemifier .steemifier-comments-order', (event) => {
      if (this.commentsLoading) {
        return
      }
      let target = event.currentTarget
      this.displaySteemCommentsBox(jQuery(target).attr('orderBy'))
    })
    this.loadComments(orderBy)
  }

  async loadComments (orderBy = 'best') {
    console.log('steemifier-comments loading...')
    jQuery('#steemifier-comments-counter').text(`Steem comments (${this.datamodule.post.children})`)

    await this.orderComments(this.datamodule.post.replies, orderBy)

    let steemCommentsBox = jQuery('#steemifier-steem-comments-box')

    this.displayComments(-1, steemCommentsBox, this.datamodule.post.replies)

    jQuery(window).off('scroll').on('scroll', () => {
      if (this.commentsLoading) {
        return
      }

      let position = jQuery(window).scrollTop()
      let commentBoxHeight = steemCommentsBox.height()

      if ((commentBoxHeight > 0) && (position >= commentBoxHeight)) {
        const lastComment = jQuery('.steemifier #steemifier-steem-comments-box article.depth-1:last')
        const index = lastComment.data('index')
        this.displayComments(index, steemCommentsBox, this.datamodule.post.replies)
      }
    })

    console.log('steemifier-comments loaded...')
  }

  async displayChildrenComments (targetDisply, author, permlink) {
    const replies = await this.datamodule.getContentRepliesAsync(author, permlink)
    await this.orderComments(replies, 'oldest')
    this.displayComments(-1, targetDisply, replies, true)
  }

  orderComments (comments, orderBy) {
    return new Promise(resolve => {
      comments.sort((a, b) => {
        if (orderBy === 'newest') {
          a = new Date(a.created)
          b = new Date(b.created)
          return a > b ? -1 : a < b ? 1 : 0
        } else if (orderBy === 'oldest') {
          a = new Date(a.created)
          b = new Date(b.created)
          return a < b ? -1 : a > b ? 1 : 0
        } else if (orderBy === 'best') {
          a = common.parsePayoutAmount(a.pending_payout_value) === 0 ? common.parsePayoutAmount(a.total_payout_value) + common.parsePayoutAmount(a.curator_payout_value) : common.parsePayoutAmount(a.pending_payout_value)
          b = common.parsePayoutAmount(b.pending_payout_value) === 0 ? common.parsePayoutAmount(b.total_payout_value) + common.parsePayoutAmount(b.curator_payout_value) : common.parsePayoutAmount(b.pending_payout_value)
          return a > b ? -1 : a < b ? 1 : 0
        }
      })

      resolve()
    })
  }

  displayComment (target, comment, index) {
    return new Promise(async resolve => {
      const post = await this.datamodule.getContentAsync(comment.author, comment.permlink)
      const votes = post.active_votes
      const upvoted = await common.hasUserUpvotedPost(votes) ? 'upvoted' : ''
      const payoutDetails = common.displayPayout(post)

      // check if this comment has comments
      let showRepliesLink = ''
      if (comment.children > 0) {
        let replyStr = comment.children === 1 ? 'reply' : 'replies'
        showRepliesLink = `<a class="show-replies">Show ${comment.children} ${replyStr}</a>  · `
      }

      let body = common.parseContent(comment.body)
      body = body.replace('<img', '<img style="max-width: auto;" height="auto"')

      target.append(`
        <article class="media comment depth-${comment.depth}" data-index="${index}" data-author="${comment.author}" data-permlink="${comment.permlink}">
          <figure class="media-left">
            <a target="_blank" href="https://busy.org/@${comment.author}">
              <p class="image">
                <img class="avatar-rounded" style="min-width: 40px; width: 40px; height: 40px;" src="https://steemitimages.com/u/${comment.author}/avatar/small">
              </p>
            </a>
          </figure>
          <div class="media-content">
            <div class="content" >
              <p>
                <a target="_blank" href="https://busy.org/@${comment.author}"><strong>${comment.author}</strong></a> <small>${moment(comment.created, 'YYYY-MM-DDTHH:mm:ss').fromNow()}</small>
                <br>
                <div class="comment-body">${body}</div>
                ${this.datamodule.username && comment.author === this.datamodule.username ? `<div class="comment-body-hidden" style="display:none;">${comment.body}</div>` : ''}
                <br>
                <small>
                  <span class="vote-button ${upvoted}" data-author="${comment.author}" data-permlink="${comment.permlink}">
                    ${common.svgLike('14px')}
                  </span>
                  <span class="has-text-primary steemifier-tooltip vote-list-button" data-author="${comment.author}" data-permlink="${comment.permlink}"> 
                    <span class="vote-counter">${votes.length}</span>
                    <span class="steemifier-tooltip-wrapper">
                      <span class="steemifier-tooltiptext" style="width: 100px">${common.displayVotesTooltip(votes)}</span>
                    </span>
                  </span> ·
                  <span class="has-text-primary steemifier-tooltip">
                    $${payoutDetails.payoutTitle}
                    <span class="steemifier-tooltip-wrapper"> 
                      <span class="steemifier-tooltiptext">
                        ${payoutDetails.payoutInfo}
                      </span>
                    </span>
                  </span> ·
                  ${showRepliesLink} 
                   <a class="reply-comment">Reply</a>
                   ${this.datamodule.username && comment.author === this.datamodule.username ? ` · <a class="edit-comment" data-parent-author="${comment.parent_author}" data-parent-permlink="${comment.parent_permlink}">Edit</a>` : ''} 
                </small>
              </p>
            </div>
        </article>
      `)

      resolve()
    })
  }

  async displayComments (startingIndex, target, comments, loadAll = false) {
    this.commentsLoading = true

    let maxCommentsPerLoad = loadAll ? comments.length : 10
    let commentsArraySize = comments.length

    if (startingIndex === undefined || commentsArraySize <= 0 || startingIndex === (commentsArraySize - 1)) {
      this.commentsLoading = false
      return
    }

    // load vote only if it exists
    for (let i = startingIndex + 1; (i <= startingIndex + maxCommentsPerLoad) && (i < commentsArraySize); i++) {
      await this.displayComment(target, comments[i], i)
    }

    jQuery(document).off('click', '.steemifier .show-replies').on('click', '.steemifier .show-replies', (event) => {
      const link = jQuery(event.currentTarget)
      let showComments = link.text().startsWith('Show')

      if (showComments) {
        const commentArticle = link.closest('article')
        const childArticle = commentArticle.find('article.comment')

        if (childArticle.val() === undefined) {
          const author = commentArticle.data('author')
          const permlink = commentArticle.data('permlink')
          const commentsTargetDisply = link.closest('.content')

          this.displayChildrenComments(commentsTargetDisply, author, permlink)
        } else {
          childArticle.show()
        }
        let linkStr = link.text()
        link.text(linkStr.replace('Show', 'Hide'))
      } else {
        link.closest('.content').find('article.comment').hide()
        let linkStr = link.text()
        link.text(linkStr.replace('Hide', 'Show'))
      }
    })

    common.addListenerReplyButton()
    common.addListenerEditButton()
    common.addListenerVoteButton()
    common.addListenerSubmitVoteButton()
    common.addListenerVoteListButton()

    this.commentsLoading = false
  }
}
