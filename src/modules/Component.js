export class Component {
  constructor (target, datamodule) {
    this.target = target
    this.datamodule = datamodule
  }

  load () {
    return new Promise((resolve) => {
      const waitForElement = () => {
        const element = document.querySelector(this.target)
        if (element) {
          resolve(element)
        } else {
          window.requestAnimationFrame(waitForElement)
        }
      }
      waitForElement()
    }).then(() => {
      if (document.querySelector(this.id)) {
        return Promise.resolve()
      } else {
        return this.onLoaded()
      }
    })
  }

  onLoaded () {}
}
