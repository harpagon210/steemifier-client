import jQuery from 'jquery'
import { Component } from './Component'
import * as common from './common'

export default class Counters extends Component {
  get id () {
    return '#steemifier-counters'
  }

  onLoaded () {
    return new Promise(async resolve => {
      const votesRendererTooltip = common.displayVotesTooltip(this.datamodule.post.active_votes)
      const upvoted = await common.hasUserUpvotedPost(this.datamodule.post.active_votes) ? 'upvoted' : ''

      // payout information
      const payoutDetails = common.displayPayout(this.datamodule.post)

      let htmlTxt = `
      <span id="steemifier-counters">
        <span id="counters">
          <span id="payout" class="has-text-primary steemifier-tooltip">&nbsp;&nbsp;$${payoutDetails.payoutTitle}   
            <span class="steemifier-tooltip-wrapper"> 
              <span class="steemifier-tooltiptext">
                ${payoutDetails.payoutInfo}
              </span>
            </span>
          </span>
          <span id="votes">
            &nbsp;&nbsp;
            <span class="vote-button ${upvoted}" data-author="${this.datamodule.post.author}" data-permlink="${this.datamodule.post.permlink}">
              ${common.svgLike('20px')}
            </span>
            <span class="has-text-primary is-size-5 steemifier-tooltip vote-list-button" data-author="${this.datamodule.post.author}" data-permlink="${this.datamodule.post.permlink}">
              <span class="vote-counter">${this.datamodule.post.active_votes.length}</span>
              <span class="steemifier-tooltip-wrapper">
                <span class="steemifier-tooltiptext" style="width: 150px">${votesRendererTooltip}</span>
              </span>
            </span>
          </span>
        
          <div id="vote-modal" class="modal">
            <div class="modal-background"></div>
            <div class="modal-card">
              <header class="modal-card-head">
                <p class="modal-card-title">Vote settings</p>
                <button class="delete vote-modal-close" aria-label="close"></button>
              </header>
              <section class="modal-card-body">
                <span class="vote-modal-content is-invisible">
                  <p class="voting-power"></p>
                  <br />
                  <input id="vote-weight-slider" class="slider is-fullwidth is-primary is-medium" step="0.1" min="0.00" max="100.00" value="100.00" type="range">
                  <p class="vote-weight"></p>
                  <br />
                  <p class="vote-value"></p>
                </span>
              </section>
              <footer class="modal-card-foot">
                <button id="vote-submit" class="button is-primary is-size-4">Submit your vote</button>
                <button class="button vote-modal-close is-size-4">Cancel</button>
              </footer>
            </div>
          </div>

          <div id="display-vote-modal" class="modal">
            <div class="modal-background"></div>
            <div class="modal-card">
              <header class="modal-card-head">
                <p class="modal-card-title">Votes details</p>
                <button class="delete display-vote-modal-close" aria-label="close"></button>
              </header>
              <section class="modal-card-body">
                <table class="table is-striped is-hoverable is-fullwidth">
                  <tbody id="list-vote-modal">
                  </tbody>
                </table>
              </section>
              <footer class="modal-card-foot">
                <button class="button display-vote-modal-close is-primary is-size-4">Done</button>
              </footer>
            </div>
          </div>
        </span>
      </span>
      `
      jQuery(this.target + ' .view-count').append(htmlTxt)

      common.addListenerVoteButton()
      common.addListenerSubmitVoteButton()
      common.addListenerVoteListButton()

      console.log(`${this.id} loaded`)
      resolve()
    })
  }
}
