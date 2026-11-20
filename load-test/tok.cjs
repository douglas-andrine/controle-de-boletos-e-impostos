const {createHmac}=require("crypto");const s=require("fs").readFileSync(__dirname+"/load.env","utf8").match(/JWT_SECRET=(.*)/)[1];
const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const n=Math.floor(Date.now()/1000);
const t=b({alg:"HS256",typ:"JWT"})+"."+b({sub:process.argv[2],iat:n,exp:n+3600});console.log(t+"."+createHmac("sha256",s).update(t).digest("base64url"));
