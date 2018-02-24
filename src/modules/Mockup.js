export default class Mockup extends Component {
    get id () {
      return '#id'
    }
  
    onLoaded () {
      return new Promise(resolve => {

        console.log(`${this.id} loaded`)
        resolve()
      })
    }
  }
  