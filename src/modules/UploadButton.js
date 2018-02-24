import jQuery from 'jquery'
import * as common from './common'
import { Component } from './Component'

export default class UploadButton extends Component {
  get id () {
    return '#steemifier-upload'
  }

  onLoaded () {
    return new Promise(resolve => {
      jQuery(this.target).prepend(`<span id="steemifier-upload"><div class="button is-primary is-medium">steemifier</div></span>`)

      jQuery('#steemifier-upload .button').on('click', (event) => {
        let btn = jQuery(event.currentTarget)
        btn.addClass('is-loading')
        common.addContent().then(() => {
          btn.removeClass('is-loading')
        })
      })

      console.log(`${this.id} loaded`)
      resolve()
    })
  }
}
