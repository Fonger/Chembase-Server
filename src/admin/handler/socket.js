const pty = require('node-pty')
const path = require('path')

module.exports = function (socket) {
  socket.on('shell-start', function (data) {
    if (data === 'iwantadminshell') {
      const term = pty.spawn('/usr/bin/mongo', ['-u', 'fonger', '-p', '', '--quiet', '--authenticationDatabase', 'admin'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: '/',
        env: {
          PATH: process.env.PATH,
          HOME: path.join(process.cwd(), 'chemshell'),
          MONGOUSER: 'fonger',
          MONGOPWD: ''
        }
      })
      socket.on('shell', function (data) {
        term.write(data)
      })
      socket.on('shell-resize', function (data) {
        if (data) {
          term.resize(data.cols || 80, data.rows || 30)
        }
      })
      term.on('data', (data) => socket.emit('shell', data))
      term.on('close', () => {
        socket.disconnect()
      })
      socket.on('disconnect', () => {
        term.write(String.fromCharCode(3)) // send ^C (SIGINT) to shell
        // term.kill('SIGKILL') no permission..
      })
    } else {
      socket.disconnect()
    }
  })
}