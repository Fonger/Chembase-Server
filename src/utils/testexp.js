const expression = require('./expression')

// 限制
let ast = expression.parse(`
    compound["user"+"name"] == "admin" &&
    compound.badguy.cc == 5
    && simple() <= 7
    && get().name=="jerry"
    && compound.aaa.bbb.ccc.ddd > delayGetValue(-1,1000)
`
)

console.log(JSON.stringify(ast, null, 2))
// query aaa.bbb.ccc.ddd < 3
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

let val = expression.runQueryACL(ast, context, query).then(console.log, (err) => {
  console.log('ERR <3')
  console.error(err)
})
console.log(val)
