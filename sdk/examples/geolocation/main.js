/* eslint-disable */

const simulate = true

let user;
let marker
let position;
let positionPair;
let localUserCompound;
let firstRun = true

const userMarkers = {}
const lab = new Chembase.Lab('gps1001')

if (navigator.geolocation && !simulate) {
  navigator.geolocation.watchPosition(onCurrentPosition)
} else {
  onCurrentPosition({ coords: { latitude: 24.78678324416636, longitude: 120.99745100199137 } });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function onCurrentPosition(pos) {
  position = new L.LatLng(pos.coords.latitude, pos.coords.longitude)
  positionPair = [pos.coords.longitude, pos.coords.latitude]

  if (firstRun) {
    mymap.setView(position, 16)
    L.circle(position, 300).addTo(mymap)
    firstRun = false
  }

  if (localUserCompound) {
    localUserCompound.update({ location: positionPair })
  }
}

if (getParam('verify') === 'true') {
  lab.verify(getParam('id'), getParam('code')).then(() => {
    alert('驗證成功!')
  }).catch((err) => {
    alert('驗證失敗!')
    console.error(err);
  })
}

$('#loginForm').submit(async function (event) {
  event.preventDefault()
  await lab.logout()
  const login = {
    method: 'email',
    email: $('#user').val(),
    password: $('#password').val()
  }
  await sleep(500)
  try {
    user = await lab.login(login)
    start()
  } catch (err) {
    alert('Error!')
    console.error(err);
  }
})

$('#emailRegisterBtn').click(async function (event) {
  event.preventDefault();
  await lab.logout()
  const login = {
    method: 'email',
    email: $('#user').val(),
    password: $('#password').val()
  }
  try {
    user = await lab.register(login)
    localUserCompound = await lab.beaker('user').create({
      _id: user._id,
      location: positionPair,
      name: $('#name').val()
    })
  } catch (err) {
    alert('Error!')
    console.error(err)
  }
})

$('#ldapLoginBtn').click(async function (event) {
  event.preventDefault()
  await lab.logout()
  const login = {
    method: 'ldap',
    username: $('#user').val(),
    password: $('#password').val()
  }
  try {
    user = await lab.login(login)
    start()
  } catch (err) {
    alert('Error!')
    console.error(err)
  }
})

let messages = []

function addOrUpdateUserMark(userCompound) {
  let userData = userCompound.data ? userCompound.data() : userCompound
  let id = userData._id.toString()
  let posPair = [userData.location[1], userData.location[0]]

  let marker = userMarkers[id]
  if (marker) {
    marker.setLatLng(posPair)
  } else {
    let popup = new L.popup({ closeOnClick: false, autoClose: false, closeOnEscapeKey: false })
      .setContent(userData.name)

    let isMyMarker = userData._id.equals(user._id)
    let options = {}
    if (isMyMarker) {
      options = {
        draggable: true,
        icon: redIcon,
        zIndexOffset: 1000
      }
    }

    marker = L.marker(posPair, options).addTo(mymap).bindPopup(popup)
    if (simulate && isMyMarker) {
      marker.on('drag', function(event) {
        const marker = event.target;
        const position = marker.getLatLng();
        onCurrentPosition({ coords: { latitude: position.lat, longitude: position.lng } });
      })
      marker.on('dragend', function(event) {
        const marker = event.target;
        marker.openPopup()
      })
    }
    marker.openPopup()
    userMarkers[id] = marker
  }
}
function deleteUserMark(userCompound) {
  const id = userCompound._id.toString()
  let marker = userMarkers[id]
  if (marker && id !== user._id.toString()) {
    mymap.removeLayer(marker)
    delete userMarkers[id]
  }
}
async function start() {
  try {
    const area = { center: positionPair, radius: 0.3 / 6371, spherical: true }

    try {
      localUserCompound = await lab.beaker('user').get(user._id)
      await localUserCompound.update({ location: positionPair })
    } catch (err) {
      localUserCompound = await lab.beaker('user').create({
        _id: user._id,
        location: positionPair,
        name: $('#name').val()
      })
    }

    let query = lab.beaker('user').where('location').within().circle(area)
    let userCompounds = await query.find()
    for(let comp of userCompounds) {
      addOrUpdateUserMark(comp)
    }

    await query.subscribe(function (err, change) {
      if (err) return console.error(err)
      let message = change.compound
      switch (change.type) {
        case 'create':
        case 'update':
          addOrUpdateUserMark(change.compound)
          break;
        case 'delete':
          deleteUserMark(change.compound)
        default:
          break
      }
    })

  } catch (err) {
    console.error(err)
  }
}
