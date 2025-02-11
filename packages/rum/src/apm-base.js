/**
 * MIT License
 *
 * Copyright (c) 2017-present, Elasticsearch BV
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

import {
  getInstrumentationFlags,
  PAGE_LOAD,
  ERROR
} from '@elastic/apm-rum-core'

class ApmBase {
  constructor(serviceFactory, disable) {
    this._disable = disable
    this.serviceFactory = serviceFactory
    this._initialized = false
  }

  init(config) {
    if (this.isEnabled() && !this._initialized) {
      this._initialized = true
      const configService = this.serviceFactory.getService('ConfigService')
      /**
       * Set Agent version to be sent as part of metadata to the APM Server
       */
      configService.setVersion('4.6.0')
      this.config(config)
      const loggingService = this.serviceFactory.getService('LoggingService')
      /**
       * Deactive agent when the active config flag is set to false
       */
      if (configService.isActive()) {
        this.serviceFactory.init()

        const flags = getInstrumentationFlags(
          configService.get('instrument'),
          configService.get('disableInstrumentations')
        )

        const performanceMonitoring = this.serviceFactory.getService(
          'PerformanceMonitoring'
        )
        performanceMonitoring.init(flags)

        if (flags[ERROR]) {
          const errorLogging = this.serviceFactory.getService('ErrorLogging')
          errorLogging.registerListeners()
        }

        const sendPageLoad = () =>
          flags[PAGE_LOAD] && this._sendPageLoadMetrics()

        if (configService.get('centralConfig')) {
          /**
           * Waiting for the remote config before sending the page load transaction
           */
          this.fetchCentralConfig().then(sendPageLoad)
        } else {
          sendPageLoad()
        }
      } else {
        loggingService.info('RUM agent is inactive')
      }
    }
    return this
  }

  /**
   * `fetchCentralConfig` returns a promise that will always resolve
   * if the internal config fetch fails the the promise resolves to `undefined` otherwise
   * it resolves to the fetched config.
   */
  fetchCentralConfig() {
    const apmServer = this.serviceFactory.getService('ApmServer')
    const loggingService = this.serviceFactory.getService('LoggingService')
    const configService = this.serviceFactory.getService('ConfigService')

    return apmServer
      .fetchConfig(
        configService.get('serviceName'),
        configService.get('environment')
      )
      .then(config => {
        var transactionSampleRate = config['transaction_sample_rate']
        if (transactionSampleRate) {
          transactionSampleRate = Number(transactionSampleRate)
          const config = { transactionSampleRate }
          const { invalid } = configService.validate(config)
          if (invalid.length === 0) {
            configService.setConfig(config)
          } else {
            const { key, value, allowed } = invalid[0]
            loggingService.warn(
              `invalid value "${value}" for ${key}. Allowed: ${allowed}.`
            )
          }
        }
        return config
      })
      .catch(error => {
        loggingService.warn('failed fetching config:', error)
      })
  }

  _sendPageLoadMetrics() {
    const transactionService = this.serviceFactory.getService(
      'TransactionService'
    )

    /**
     * Name of the transaction is set in transaction service to
     * avoid duplicating the logic at multiple places
     */
    const tr = transactionService.startTransaction(undefined, PAGE_LOAD, {
      managed: true,
      canReuse: true
    })

    if (tr) {
      tr.addTask(PAGE_LOAD)
    }
    const sendPageLoadMetrics = function sendPageLoadMetrics() {
      // to make sure PerformanceTiming.loadEventEnd has a value
      setTimeout(function() {
        if (tr) {
          tr.removeTask(PAGE_LOAD)
        }
      })
    }

    if (document.readyState === 'complete') {
      sendPageLoadMetrics()
    } else {
      window.addEventListener('load', sendPageLoadMetrics)
    }
  }

  isEnabled() {
    return !this._disable
  }

  observe(name, fn) {
    const configService = this.serviceFactory.getService('ConfigService')
    configService.events.observe(name, fn)
  }

  /**
   * When the required config keys are invalid, the agent is deactivated with
   * logging error to the console
   *
   * validation error format
   * {
   *  missing: [ 'key1', 'key2']
   *  invalid: [{
   *    key: 'a',
   *    value: 'abcd',
   *    allowed: 'string'
   *  }]
   * }
   */
  config(config) {
    const configService = this.serviceFactory.getService('ConfigService')
    const { missing, invalid } = configService.validate(config)
    if (missing.length === 0 && invalid.length === 0) {
      configService.setConfig(config)
    } else {
      const loggingService = this.serviceFactory.getService('LoggingService')
      const separator = ', '
      let message = "RUM agent isn't correctly configured. "

      if (missing.length > 0) {
        message += missing.join(separator) + ' is missing'
        if (invalid.length > 0) {
          message += separator
        }
      }

      invalid.forEach(({ key, value, allowed }, index) => {
        message +=
          `${key} "${value}" contains invalid characters! (allowed: ${allowed})` +
          (index !== invalid.length - 1 ? separator : '')
      })
      loggingService.error(message)
      configService.setConfig({ active: false })
    }
  }

  setUserContext(userContext) {
    var configService = this.serviceFactory.getService('ConfigService')
    configService.setUserContext(userContext)
  }

  setCustomContext(customContext) {
    var configService = this.serviceFactory.getService('ConfigService')
    configService.setCustomContext(customContext)
  }

  addTags(tags) {
    const loggingService = this.serviceFactory.getService('LoggingService')
    loggingService.warn('addTags deprecated, please use addLabels')
    this.addLabels(tags)
  }

  addLabels(labels) {
    var configService = this.serviceFactory.getService('ConfigService')
    configService.addLabels(labels)
  }

  // Should call this method before 'load' event on window is fired
  setInitialPageLoadName(name) {
    if (this.isEnabled()) {
      var configService = this.serviceFactory.getService('ConfigService')
      configService.setConfig({
        pageLoadTransactionName: name
      })
    }
  }

  startTransaction(name, type, options) {
    if (this.isEnabled()) {
      var transactionService = this.serviceFactory.getService(
        'TransactionService'
      )
      return transactionService.startTransaction(name, type, options)
    }
  }

  startSpan(name, type) {
    if (this.isEnabled()) {
      var transactionService = this.serviceFactory.getService(
        'TransactionService'
      )
      return transactionService.startSpan(name, type)
    }
  }

  getCurrentTransaction() {
    if (this.isEnabled()) {
      var transactionService = this.serviceFactory.getService(
        'TransactionService'
      )
      return transactionService.getCurrentTransaction()
    }
  }

  getTransactionService() {
    if (this.isEnabled()) {
      var transactionService = this.serviceFactory.getService(
        'TransactionService'
      )
      return transactionService
    }
  }

  captureError(error) {
    if (this.isEnabled()) {
      var errorLogging = this.serviceFactory.getService('ErrorLogging')
      return errorLogging.logError(error)
    }
  }

  addFilter(fn) {
    var configService = this.serviceFactory.getService('ConfigService')
    configService.addFilter(fn)
  }
}

export default ApmBase
