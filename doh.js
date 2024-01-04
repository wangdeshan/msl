var get = require("axios").get;
// console.log(axios)
async function DnsOverHTTP(domain, callback) {
    var v4only = false;
    var v6only = false;
    // console.log('Start Resolve', domain)

    try {
        if (!v6only) {
            // console.log('Try IPv4', domain)
            let datav4 = await QueryDOH(domain, 'A');
            if (datav4.status != 200) {
                return callback("", {
                    "err": 1,
                    "error": "DOH Server (A) Return Non HTTP200",
                    "data": datav4
                })
            }

            let v4data = datav4.data;
            if (v4data.Status) {
                return callback("", {
                    "err": 2,
                    "error": "DOH Srrver (A) Query ResultStatus Non 0",
                    "data": v4data
                })
            }

            if (v4data['Answer'] != undefined) {
                let v4ans = v4data['Answer'];
                let addrs4 = new Array();

                for (let i in v4ans) {
                    if (v4ans[i].type == 1) {
                        addrs4.push(v4ans[i].data)
                    }
                }

                return callback(addrs4, {
                    "err": 0
                })
            } else if (v4only) {
                return callback("", {
                    "err": 3,
                    "error": "DOH Srrver (A) No IPv4 Recoder",
                    "data": v4data
                })
            }

            // console.log('No IPv4(A) Trying IPv6(AAAA)', domain)
        }
        if (!v4only) {
            // console.log('Try IPv6', domain)
            let datav6 = await QueryDOH(domain, "AAAA");
            if (datav6.status != 200) {
                return callback("", {
                    "err": 4,
                    "error": "DOH Server (AAAA) Return Non HTTP200",
                    "data": datav6
                })
            }
            let v6data = datav6.data;

            if (v6data.Status) {
                return callback("", {
                    "err": 5,
                    "error": "DOH Srrver (AAAA) Query ResultStatus Non 0",
                    "data": v6data
                })
            }

            if (v6data['Answer'] != undefined) {
                let v6ans = v6data['Answer'];
                let addrs6 = new Array();

                for (let i in v6ans) {
                    if (v6ans[i].type == 28) {
                        addrs6.push("[" + v6ans[i].data + "]")
                    }
                }
                return callback(addrs6, {
                    "err": 0
                })
            } else {
                return callback("", {
                    "err": 6,
                    "error": "DOH Srrver (AAAA) No IPv6 Recoder",
                    "data": v6data
                })
            }
        }
        callback("", {
            "err": 7,
            "error": "No A or AAAA Recoder"
        })

    } catch (error) {
        callback('', {
            "err": 8,
            "error": error
        })
    }
}

async function QueryDOH(name, type) {
    let data = await get('http://1.1.1.1/dns-query', {
        headers: {
            'accept': 'application/dns-json'
        },
        params: {
            type: type,
            name: name
        }
    });
    return data;
}

module.exports = DnsOverHTTP;
