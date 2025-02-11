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

import Url from '../../src/common/url'

describe('Url parser', function() {
  it('should parse relative url', function() {
    var result = new Url(
      '/path?param=value&param2=value2&0=zero&foo&empty=&key=double=double&undefined'
    )
    expect(result).toEqual(
      jasmine.objectContaining({
        protocol: 'http:',
        path: '/path',
        query:
          '?param=value&param2=value2&0=zero&foo&empty=&key=double=double&undefined',
        hash: ''
      })
    )
  })

  it('should parse absolute url', function() {
    var result = new Url('http://test.com/path.js?param=value')
    expect(result).toEqual(
      jasmine.objectContaining({
        protocol: 'http:',
        path: '/path.js',
        query: '?param=value',
        hash: '',
        host: 'test.com',
        origin: 'http://test.com'
      })
    )
  })

  it('should parse url with fragment part', function() {
    var result = new Url('http://test.com/path?param=value#fragment')
    expect(result).toEqual(
      jasmine.objectContaining({
        hash: '#fragment',
        query: '?param=value',
        path: '/path'
      })
    )
  })

  it('should parse url with fragment before query string', function() {
    var result = new Url('http://test.com/path#fragment?param=value')
    expect(result).toEqual(
      jasmine.objectContaining({
        hash: '#fragment?param=value',
        query: '',
        path: '/path'
      })
    )
  })

  it('should parse url with leading &', function() {
    var result = new Url('/path/?&param=value')
    expect(result).toEqual(
      jasmine.objectContaining({
        path: '/path/',
        query: '?&param=value'
      })
    )
  })

  it('should parse url with not querystring', function() {
    var result = new Url('/path')
    expect(result).toEqual(
      jasmine.objectContaining({
        path: '/path',
        query: ''
      })
    )
  })

  it('should parse url with only the querystring', function() {
    var result = new Url('?param=value')
    expect(result).toEqual(
      jasmine.objectContaining({
        path: '/',
        query: '?param=value'
      })
    )
  })

  it('should parse url correctly without /', () => {
    expect(new Url('api/foo')).toEqual(
      jasmine.objectContaining({
        path: '/api/foo',
        query: '',
        hash: '',
        relative: true,
        protocol: 'http:'
      })
    )

    expect(new Url('api/foo?a=b')).toEqual(
      jasmine.objectContaining({
        path: '/api/foo',
        query: '?a=b',
        hash: ''
      })
    )

    expect(new Url('api/foo#fragment')).toEqual(
      jasmine.objectContaining({
        path: '/api/foo',
        hash: '#fragment'
      })
    )
  })

  it('should inherit protocol for relative urls with protocols', () => {
    expect(new Url('//foo.com/bar')).toEqual(
      jasmine.objectContaining({
        path: '/bar',
        host: 'foo.com',
        protocol: 'http:'
      })
    )
  })

  it('should parse auth in the URL', function() {
    expect(new Url('http://a:b@c')).toEqual(
      jasmine.objectContaining({
        auth: 'a:b',
        hash: '',
        host: 'c',
        href: 'http://[REDACTED]:[REDACTED]@c',
        origin: 'http://c',
        path: '',
        protocol: 'http:',
        query: ''
      })
    )
    expect(new Url('http://a@b@c/')).toEqual(
      jasmine.objectContaining({
        auth: 'a@b',
        hash: '',
        host: 'c',
        href: 'http://[REDACTED]@c/',
        origin: 'http://c',
        path: '/',
        protocol: 'http:',
        query: ''
      })
    )
    expect(new Url('http://a@b?@c')).toEqual(
      jasmine.objectContaining({
        auth: 'a',
        hash: '',
        host: 'b',
        href: 'http://[REDACTED]@b?@c',
        origin: 'http://b',
        path: '',
        protocol: 'http:',
        query: '?@c'
      })
    )
    expect(
      new Url(
        'http://user:pass@mt0.google.com/vt/lyrs=m@114???&hl=en&src=api&x=2&y=2&z=3&s='
      )
    ).toEqual(
      jasmine.objectContaining({
        auth: 'user:pass',
        hash: '',
        host: 'mt0.google.com',
        href:
          'http://[REDACTED]:[REDACTED]@mt0.google.com/vt/lyrs=m@114???&hl=en&src=api&x=2&y=2&z=3&s=',
        origin: 'http://mt0.google.com',
        path: '/vt/lyrs=m@114',
        protocol: 'http:',
        query: '???&hl=en&src=api&x=2&y=2&z=3&s='
      })
    )
    expect(new Url('http://user:pass@-lovemonsterz.tumblr.com/rss')).toEqual(
      jasmine.objectContaining({
        auth: 'user:pass',
        hash: '',
        host: '-lovemonsterz.tumblr.com',
        href: 'http://[REDACTED]:[REDACTED]@-lovemonsterz.tumblr.com/rss',
        origin: 'http://-lovemonsterz.tumblr.com',
        path: '/rss',
        protocol: 'http:',
        query: ''
      })
    )
    expect(new Url('http://a@b/c@d')).toEqual(
      jasmine.objectContaining({
        auth: 'a',
        hash: '',
        host: 'b',
        href: 'http://[REDACTED]@b/c@d',
        origin: 'http://b',
        path: '/c@d',
        protocol: 'http:',
        query: ''
      })
    )
  })
})
