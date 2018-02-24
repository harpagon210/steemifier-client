import '../../../steemifier/css/steemifier.scss'
import {postMessage, parseContent} from '../../../modules/common'
import jQuery from 'jquery'
import Tagify from 'bulma-extensions/bulma-tagsinput/dist/bulma-tagsinput.js'
import Noty from 'noty'

let dataModule = {}
let oldVal = ''

const init = (params) => { // eslint-disable-line no-unused-vars
  let urlParams = params.split('?')[1].split('&')
  let contentId = urlParams.filter((el) => {
    if (el.match('id') !== null) {
      return true
    }
  })[0].split('=')[1]

  postMessage({
    'action': 'getAccessTokens',
    'params': ['st', 'yt']
  })
    .then(resp => {
      if (resp.err === undefined) {
        dataModule = {
          'contentId': contentId,
          'st': resp.response.st,
          'yt': resp.response.yt
        }

        console.log(dataModule)
        loadContent()

        addListenerTextarea()
      }
    })
}

const loadContent = () => {
  const ytApiKey = process.env.YOUTUBE_API_KEY
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${dataModule.contentId}&part=snippet&key=${ytApiKey}`
  fetch(url) // eslint-disable-line no-undef
    .then(response => {
      if (response.ok) {
        return Promise.resolve(response)
      } else {
        return Promise.reject(new Error('Failed to load'))
      }
    })
    .then(response => response.json()) // parse response as JSON
    .then(videoData => {
      // success
      console.log(videoData)
      jQuery('#title').val(videoData.items[0].snippet.title)
      let tags = videoData.items[0].snippet.tags ? videoData.items[0].snippet.tags.join(',') : ''
      jQuery('#tags-input').val(tags)
      jQuery('#tags-input').attr('placeholder', 'steemifier, busy, steem, ...')
      new Tagify(jQuery('#tags-input').get()[0]) // eslint-disable-line no-new

      const linkYoutube = `https://www.youtube.com/watch?v=${dataModule.contentId}\n\n`
      const desc = linkYoutube + videoData.items[0].snippet.description

      jQuery('#content').val(desc)
      jQuery('#preview').append(parse(desc))

      const urlChannel = `https://www.googleapis.com/youtube/v3/channels/?mine=true&part=snippet`
      fetch(urlChannel, { // eslint-disable-line no-undef
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + dataModule.yt
        }
      })
        .then(response => {
          if (response.ok) {
            return Promise.resolve(response)
          } else {
            return Promise.reject(new Error('Failed to load'))
          }
        })
        .then(response => response.json()) // parse response as JSON
        .then(channelData => {
          console.log(channelData)

          const videoChannelId = videoData.items[0].snippet.channelId
          const channels = channelData.items.filter(el => el.id === videoChannelId)
          if (channels.length === 1) {
            jQuery('#post').on('click', (event) => post(event))
          } else {
            jQuery('#error-modal').addClass('is-active')
          }
        }).catch((error) => {
          console.log(`Error: ${error.message}`)
        })
    })
    .catch((error) => {
      console.log(error)
      console.log(`Error: ${error.message}`)
    })
}

const post = (event) => {
  jQuery(event.currentTarget).addClass('is-loading')

  if (!ContentHasErrors()) {
    postMessage({
      'action': 'getAccessTokens',
      'params': ['st', 'yt']
    })
      .then(resp => {
        if (resp.err === undefined) {
          const payload = {
            'contentId': dataModule.contentId,
            'st': resp.response.st,
            'yt': resp.response.yt,
            'title': jQuery('#title').val(),
            'tags': jQuery('#tags-input').val(),
            'content': jQuery('#content').val(),
            'rewardOption': jQuery('#reward-option').val()
          }

          console.log(payload)

          // jQuery.ajax('http://localhost:3000/content', {
          jQuery.ajax(`${process.env.STEEMIFIER_SERVER_URL}/content`, {
            method: 'POST',
            contentType: 'application/json',
            processData: false,
            data: JSON.stringify(payload)
          })
            .then(resp => {
              console.log(resp)
              if (resp.error) {
                ShowNotification('error', resp.error)
              } else {
                let link = `https://www.youtube.com/watch?v=${dataModule.contentId}`
                jQuery('#link-steemified-content').text(link)
                jQuery('#link-steemified-content').attr('href', link)

                jQuery('#link-steem-content').attr('href', `https://busy.org/@${resp.author}/${resp.permlink}`)

                jQuery('#result-modal').addClass('is-active')
              }
            })
            .catch((err) => {
              console.error(err)
              ShowNotification('error', 'An error occured during the process, please check the console logs')
            })
            .done(() => {
              jQuery(event.currentTarget).removeClass('is-loading')
            })
        } else {
          jQuery(event.currentTarget).removeClass('is-loading')
        }
      })
      .catch((err) => {
        console.error(err)
        jQuery(event.currentTarget).removeClass('is-loading')
      })
  } else {
    jQuery(event.currentTarget).removeClass('is-loading')
  }
}

// init on dom ready!
jQuery(() => {
  init(window.location.search)
})

const addListenerTextarea = () => {
  jQuery('#content').on('change keyup paste', (event) => {
    let currentVal = jQuery('#content').val()
    if (currentVal === oldVal) {
      return
    }

    oldVal = currentVal

    jQuery('#preview').html(parse(currentVal))
  })
}

const parse = (html) => {
  // parse # and @
  let parsedHtml = parseContent(html)

  // parse youtube links
  let regExp = /(https?:\/\/)?(?:www\.)?(youtu(?:\.be\/([-\w]+)|be\.com\/watch\?v=([-\w]{11})))/g

  let matches
  while ((matches = regExp.exec(html)) !== null) {
    let videoId = matches[3] === undefined ? matches[4] : matches[3]
    let youtubeFrame = `
      <iframe type="text/html" width="640" height="360"
      src="https://www.youtube.com/embed/${videoId}"
      frameborder="0"></iframe>`
    parsedHtml = parsedHtml.replace(matches[0], youtubeFrame)
  }

  return parsedHtml
}

const ContentHasErrors = () => {
  let inError = false
  // clean previous errors
  jQuery('.is-danger').removeClass('is-danger')
  jQuery('.help').remove()

  // check the title
  let titleHndl = jQuery('#title')
  let titleInError = titleHndl.val().trim() === ''
  if (titleInError) {
    titleHndl.addClass('is-danger')
    titleHndl.after(`<p class="help is-danger">The title can't be empty</p>`)
  }
  inError = inError | titleInError

  // check the content
  let contentHndl = jQuery('#content')
  let contentInError = contentHndl.val().trim() === ''
  if (contentInError) {
    contentHndl.addClass('is-danger')
    contentHndl.after(`<p class="help is-danger">The content can't be empty</p>`)
  }
  inError = inError | contentInError

  // check the tags
  let tagsHndl = jQuery('#tags-input')
  let tags = tagsHndl.val().split(',').filter((v) => { return v !== '' })

  let tagsInError = tags.length <= 0 || tags.length > 4
  if (tagsInError) {
    tagsHndl.addClass('is-danger')
    tagsHndl.after(`<p class="help is-danger">There should be between 1 and 4 tags</p>`)
  }
  inError = inError | tagsInError

  if (inError) {
    ShowNotification('error', 'Please fix the errors in order to add your content to Steemifier')
  }

  return inError
}

const ShowNotification = (type, message) => {
  new Noty({
    type: type,
    theme: 'steemifier',
    text: message,
    layout: 'bottomRight',
    timeout: '4000'
  }).show()
}
