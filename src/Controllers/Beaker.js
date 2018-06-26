function Query() {
    return this;
}
Query.prototype.where = function (para) {
    this.val = para;
    return this;
}
Query.prototype.then = function (resolve, reject) {
    return new Promise((res, rej) => {
        setTimeout(() => res(this.val), 1000);
    }).then(resolve, reject);
}

async function test(){
    let s = new Query();
    let r = await s.where(5)
    console.log(r);
}