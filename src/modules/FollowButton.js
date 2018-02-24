import jQuery from 'jquery'
import * as common from './common'
import { Component } from './Component'

export default class FollowButton extends Component {
  get id () {
    return '#steemifier-follow'
  }

  onLoaded () {
    return new Promise(resolve => {
      let btnClass = ''
      let btnText = 'FOLLOW'

      if (this.datamodule.username) {
        const users = this.datamodule.followers.filter(el => el.follower === this.datamodule.username)
        if (users.length === 1) {
          btnClass = 'following'
          btnText = `UNFOLLOW`
        }
      }

      jQuery(this.target).append(`<span id="steemifier-follow"><div id="follow-btn" class="button is-primary is-size-4 ${btnClass}" data-author="${this.datamodule.post.author}">${btnText} ${this.datamodule.followersCount}</div></span>`)
      common.addListenerFollowButton()

      console.log(`${this.id} loaded`)
      resolve()
    })
  }
}
