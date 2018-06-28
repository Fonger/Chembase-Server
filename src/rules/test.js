const RuleRunner = require('./rule-runner')

let runner = new RuleRunner(`
compound["user"+"name"] == "admin" &&
compound.badguy.cc == 5
&& simple() <= 7
&& get().name=="jerry"
&& compound.aaa.bbb.ccc.ddd > delayGetValue(-1, 1000)
`
)

let query = {
  conditions: {
    'username': {
      $eq: 'admin'
    },
    'aaa.bbb.ccc.ddd': {
      $gte: 0
    },
    'nn': {
      $gt: 3.5,
      $lt: 4
    },
    'badguy.cc': 5
  }
}

let context = {
  a: 5,
  b: 1,
  val: 'return process',
  request: {
    user: {
      id: 1234
    }
  },
  simple: () => 5,
  GetType: (variable) => {

  },
  get: async function () {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve({
          name: 'jerry'
        })
      }, 50)
    })
  },
  getValue: (value) => value,
  delayGetValue: async function (value, delayMS) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(value)
      }, delayMS)
    })
  },
  getAfter: async function () {

  }
}

async function test () {
  console.log(await runner.run(context, query))
}
test()
// console.log(runner.run(context, query))
