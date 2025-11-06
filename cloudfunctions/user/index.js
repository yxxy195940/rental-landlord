const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  switch (event.type) {
    case 'getOpenId':
      return cloud.getWXContext().OPENID
  }
}
