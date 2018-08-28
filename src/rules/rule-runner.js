const parseAST = require('jsep')

const binaryOp = require('./binary-op')
const uniaryOp = require('./uniary-op')
const logicalOp = require('./logical-op')

const { PotentialMatch, CompoundCondition } = require('./types')

/**
 * Rule parsing and running
 *
 * @class RuleRunner
 */
class RuleRunner {
  /**
   *Creates an instance of RuleRunner.
   * @param {String} rule rule script
   * @memberof RuleRunner
   */
  constructor (rule) {
    this.rule = rule
    this.ast = parseAST(rule)
  }

  /**
   * Run this script. if specified, this will be used check for query condition
   *
   * @param {Object} context global variables and functions for the rule
   * @param {Object} [query] query request object
   * @returns {Boolean} if the query meet the criteria
   * @memberof RuleRunner
   */
  async run (context, query) {
    let states = {
      compound: undefined,
      isCompound: false,
      memberCounter: 0
    }
    context = {
      ...context,
      contains: function (array, value) {
        return array.includes(value)
      },
      date: function (value) {
        if (typeof value === 'undefined') value = context.__date
        return new Date(value)
      }
    }
    const result = await this.execute(this.ast, states, context, query)

    if (result instanceof PotentialMatch) return result.valueOf()
    return result || false
  }

  async execute (node, states, context, query) {
    switch (node.type) {
      case 'ArrayExpression':
        return this.executeArray(node.elements, states, context, query)

      case 'BinaryExpression':
        let [binA, binB] = await Promise.all([
          this.execute(node.left, states, context, query),
          this.execute(node.right, states, context, query)
        ])
        return binaryOp(node.operator, binA, binB, query)

      case 'CallExpression':
        let caller, fn, assign
        if (node.callee.type === 'MemberExpression') {
          assign = await this.executeMember(node.callee, states, context, query)
          if (assign instanceof CompoundCondition) {
            throw new Error('Compound data does not have any functions!')
          }
          caller = assign[0]
          fn = assign[1]
        } else {
          fn = await this.execute(node.callee, states, context, query)
        }
        if (typeof fn !== 'function') return undefined
        return fn.apply(caller, await this.executeArray(node.arguments, states, context, query))

      case 'ConditionalExpression':
        return await this.execute(node.test, states, context, query)
          ? this.execute(node.consequent, states, context, query)
          : this.execute(node.alternate, states, context, query)

      case 'Identifier':
        return context[node.name]

      case 'Literal':
        return node.value

      case 'LogicalExpression':
        // await logicA result first
        let logicA = await this.execute(node.left, states, context, query)
        // prevent logicB from execute
        let logicBthunk = () => this.execute(node.right, states, context, query)
        return logicalOp(node.operator, logicA, logicBthunk)

      case 'MemberExpression':
        let memberResult = await this.executeMember(node, states, context, query)
        if (memberResult instanceof CompoundCondition) return memberResult
        return memberResult[1]

      case 'ThisExpression':
        return undefined

      case 'UnaryExpression':
        let pass = await this.execute(node.argument, states, context, query)
        return uniaryOp(node.operator, pass, query)

      default:
        return undefined
    }
  }

  async executeArray (list, states, context, query) {
    return Promise.all(list.map(v => this.execute(v, states, context, query)))
  }

  async executeMember (node, states, context, query) {
    states.memberCounter++
    var object = await this.execute(node.object, states, context, query)
    let name = node.computed ? await this.execute(node.property, states, context, query) : node.property.name

    if (RuleRunner.forbiddenMemberNames.includes(name)) {
      throw new Error(`No member ${name} access`)
    }

    if (query) {
      if (node.object.name === 'compound' && node.object.type === 'Identifier') {
        states.isCompound = true
        console.log(node.object)
        console.log(node.property)
        states.compound = new CompoundCondition(name)
      } else if (states.isCompound) {
        console.log(node.object)
        console.log(node.property)
        states.compound.appendSubField(name)
      }
    }

    if (node.property.type !== 'MemberExpression') {
      states.memberCounter--
    }

    if (states.isCompound) {
      if (states.memberCounter === 0) states.isCompound = false
      return states.compound
    }
    let output = [object, object[name]]
    return output
  }
}

RuleRunner.forbiddenMemberNames = ['constructor', 'prototype', '__proto__', 'bind', 'call', 'this']

parseAST.removeBinaryOp('|')
parseAST.removeBinaryOp('&')
parseAST.removeBinaryOp('^')
parseAST.removeBinaryOp('===')
parseAST.removeBinaryOp('!==')

module.exports = RuleRunner
