import jQuery from 'jquery'
import { Component } from './Component'

export default class Author extends Component {
  get id () {
    return '#steemifier-author'
  }

  onLoaded () {
    return new Promise(resolve => {
      jQuery(this.target).append(`<span id="steemifier-author"><span class="has-text-primary"> - <a target="_blank" id="author-name" class="is-size-4 is-uppercase" href="https://busy.org/@${this.datamodule.post.author}">${this.datamodule.post.author}</a></span></span>`)
      console.log(`${this.id} loaded`)
      resolve()
    })
  }
}
