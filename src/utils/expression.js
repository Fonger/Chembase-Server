const parseAST = require('jsep')
const deepEqual = require('fast-deep-equal')

/* TODO: support compare BSON.Long */
/* TODO: support compare BSON.ObjectId */

parseAST.removeBinaryOp('|')
parseAST.removeBinaryOp('&')
parseAST.removeBinaryOp('^')
parseAST.removeBinaryOp('===')
parseAST.removeBinaryOp('!==')

let mCounter = 0
let isCompound = false
let compound

class PotentialMatch {
  constructor (bool) {
    this.potential = bool
  }
  valueOf () {
    return this.potential
  }
}

class CompoundCondition {
  constructor (baseField, query) {
    this.path = baseField
    this.query = query
  }
  appendSubField (field) {
    this.path += '.' + field
  }
  valueOf () {
    if (this.query) {
      throw new Error('Cannot use this operator with compound data in Query Condition')
    }
  }
  equals (value) {
    return (value instanceof CompoundCondition) && this.path === value.path
  }
}

const binops = {
  '||': function (a, b, query) {
    if (query) {
      let result = a.valueOf() || b.valueOf()
      if (a instanceof PotentialMatch || b instanceof PotentialMatch) { return new PotentialMatch(result) }
      return result
    }
    return a || b
  },
  '&&': function (a, b, query) {
    if (query) {
      let result = a.valueOf() && b.valueOf()
      if (a instanceof PotentialMatch || b instanceof PotentialMatch) { return new PotentialMatch(result) }
      return result
    }
    return a && b
  },
  '|': function (a, b, query) { throw new Error('Invalid operator |') },
  '^': function (a, b, query) { throw new Error('Invalid operator ^') },
  '&': function (a, b, query) { throw new Error('Invalid operator &') },
  '==': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && b instanceof CompoundCondition) {
        return a.equals(b)
      }
      if (a instanceof CompoundCondition && !(b instanceof CompoundCondition)) {
        let condition = query.conditions[a.path]
        if (!condition) return false

        return deepEqual(condition.$eq || condition, b)
      }
      if (b instanceof CompoundCondition && !(a instanceof CompoundCondition)) {
        let condition = query.conditions[b.path]
        if (!condition) return false

        return deepEqual(condition.$eq || condition, a)
      }

      if (a instanceof PotentialMatch || b instanceof PotentialMatch) {
        return a.valueOf() === b.valueOf()
      }
    }
    return deepEqual(a, b)
  },
  '!=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && b instanceof CompoundCondition) {
        return !a.equals(b)
      }
      if (a instanceof CompoundCondition && !(b instanceof CompoundCondition)) {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (condition.$ne) {
          return deepEqual(condition.$ne, b)
        }

        return !deepEqual(condition.$eq || condition, b)
      }
      if (b instanceof CompoundCondition && !(a instanceof CompoundCondition)) {
        let condition = query.conditions[b.path]
        if (!condition || !condition.$ne) return false

        return deepEqual(condition.$ne || condition, a)
      }
      if (a instanceof PotentialMatch || b instanceof PotentialMatch) {
        return a.valueOf() !== b.valueOf()
      }
    }
    return !deepEqual(a, b)
  },
  '<': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition < b
        }
        if (typeof condition.$eq === 'number') {
          return condition < b
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= b)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.lgte < b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition < a
        }
        if (typeof condition.$eq === 'number') {
          return condition < a
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= a)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.$lte < a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a < b
  },
  '>': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition > b
        }
        if (typeof condition.$eq === 'number') {
          return condition > b
        }
        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= b)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte > b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition > a
        }
        if (typeof condition.$eq === 'number') {
          return condition > a
        }
        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= a)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte > a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a > b
  },
  '<=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition <= b
        }
        if (typeof condition.$eq === 'number') {
          return condition <= b
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= b)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.$lte <= b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition === 'number') {
          return condition >= a
        }
        if (typeof condition.$eq === 'number') {
          return condition >= a
        }
        if (typeof condition.$lt === 'number') {
          return new PotentialMatch(condition.$lt <= a)
        }
        if (typeof condition.$lte === 'number') {
          return new PotentialMatch(condition.$lte <= a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a <= b
  },
  '>=': function (a, b, query) {
    if (query) {
      if (a instanceof CompoundCondition && typeof b === 'number') {
        let condition = query.conditions[a.path]
        if (!condition) return false

        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= b)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte >= b)
        }
        return new PotentialMatch(false)
      } else if (b instanceof CompoundCondition && typeof a === 'number') {
        let condition = query.conditions[b.path]
        if (!condition) return false

        if (typeof condition.$gt === 'number') {
          return new PotentialMatch(condition.$gt >= a)
        }
        if (typeof condition.$gte === 'number') {
          return new PotentialMatch(condition.$gte >= a)
        }
        return new PotentialMatch(false)
      }
    }
    if (typeof a !== typeof b) return false
    return a >= b
  },
  '<<': function (a, b, query) { return a << b },
  '>>': function (a, b, query) { return a >> b },
  '>>>': function (a, b, query) { return a >>> b },
  '+': function (a, b, query) { return a + b },
  '-': function (a, b, query) { return a - b },
  '*': function (a, b, query) { return a * b },
  '/': function (a, b, query) { return a / b },
  '%': function (a, b, query) { return a % b }
}

const unops = {
  '-': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with - operator') }
    return -a
  },
  '+': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with + operator') }
    return +a
  },
  '~': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with ~ operator') }
    return ~a
  },
  '!': function (a, query) {
    if (query && (a instanceof PotentialMatch || a instanceof CompoundCondition)) { throw new Error('Cannot use with ! operator') }
    return !a
  }
}

async function executeArray (list, context, query) {
  return Promise.all(list.map(v => execute(v, context, query)))
}

const forbiddenMemberNames = ['constructor', 'prototype', '__proto__', 'bind', 'call']
async function executeMember (node, context, query) {
  mCounter++

  var object = await execute(node.object, context, query)
  let name = node.computed ? await execute(node.property, context, query) : node.property.name

  if (forbiddenMemberNames.includes(name)) {
    throw new Error(`No member ${name} access`)
  }

  if (node.object.name === 'compound' && node.object.type === 'Identifier') {
    isCompound = true
    compound = new CompoundCondition(name)
    // console.log('!!!!!!!!!!!!!!!!!!!!!!!')
  } else if (isCompound) {
    compound.appendSubField(name)
    // console.log(compound.path);
  }

  if (node.property.type !== 'MemberExpression') {
    mCounter--
    if (mCounter === 0) {
      // console.log('end member');
    }
  }

  if (isCompound) {
    if (mCounter === 0) isCompound = false
    return compound
  }
  let output = [object, object[node.property.name]]
  return output
}

async function execute (node, context, query) {
  switch (node.type) {
    case 'ArrayExpression':
      return executeArray(node.elements, context, query)

    case 'BinaryExpression':
      let a = await execute(node.left, context, query)
      let b = await execute(node.right, context, query)
      return binops[node.operator](a, b, query)

    case 'CallExpression':
      let caller, fn, assign
      if (isCompound) throw new Error('Compound data does not have any functions!')
      if (node.callee.type === 'MemberExpression') {
        assign = await executeMember(node.callee, context, query)
        caller = assign[0]
        fn = assign[1]
      } else {
        fn = await execute(node.callee, context, query)
      }
      if (typeof fn !== 'function') return undefined
      return fn.apply(caller, await executeArray(node.arguments, context, query))

    case 'ConditionalExpression':
      return await execute(node.test, context, query)
        ? execute(node.consequent, context, query)
        : execute(node.alternate, context, query)

    case 'Identifier':
      return context[node.name]

    case 'Literal':
      return node.value

    case 'LogicalExpression':
      return binops[node.operator](await execute(node.left, context, query), await execute(node.right, context, query), query)

    case 'MemberExpression':
      let result = await executeMember(node, context, query)
      if (result instanceof CompoundCondition) return result
      return result[1]

    case 'ThisExpression':
      return context

    case 'UnaryExpression':
      return unops[node.operator](await execute(node.argument, context, query), query)

    default:
      return undefined
  }
}

module.exports = {
  parse: parseAST,
  runQueryACL: (ast, context, query) => {
    return execute(ast, context, query).then((result) => {
      if (result instanceof PotentialMatch) return result.valueOf()
      return result
    })
  },
  runGetACL: (ast, context, compound) => {
    return execute(ast, context).then((result) => {
      if (result instanceof PotentialMatch) return result.valueOf()
      return result
    })
  },
  runWriteACL: (ast, context, compound) => {
    return execute(ast, context).then((result) => {
      if (result instanceof PotentialMatch) return result.valueOf()
      return result
    })
  }
}
