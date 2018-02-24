import jQuery from 'jquery'
import '../../steemifier/css/steemifier.scss'
import * as common from '../../modules/common'

// init on dom ready!
jQuery(() => {
  jQuery('#steemconnect-login-btn').click((event) => {
    common.login('st')
  })

  jQuery('#youtube-login-btn').click((event) => {
    common.login('yt')
  })

  jQuery('#logout-btn').click((event) => {
    common.logout()
  })
})
