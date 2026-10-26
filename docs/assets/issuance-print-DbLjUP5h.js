import{o as e}from"./rolldown-runtime-C0FnF6B9.js";import{Bn as t,Pr as n,Vo as r}from"./api-Cf1tGfte.js";import{lt as i,xt as a}from"./sys-C7RgsJuV.js";import{n as o,t as s}from"./print-document-DjKDa1rv.js";import{t as c}from"./dayjs.min-CbsKVrjN.js";import{t as l}from"./normalize-D-z-YgyD.js";import{r as u}from"./employees-DnBeQ47Y.js";import{t as d}from"./import-reference-CEgC14KY.js";var f=e(c(),1);function p(e,t=(0,f.default)().format(`YYYY-MM-DD`)){return e.map((e,n)=>{if(!a(e))throw h(n);let r=String(e.employeeNo??``).trim(),i=String(e.warehouseCode??``).trim(),o=String(e.issuerEmployeeNo??``).trim(),s=String(e.materialCode??``).trim(),c=l(e.issueQuantity);if(!r||!i||!o||!s||c===null||c<=0)throw h(n);let u=String(e.issueDate??``);return{employeeNo:r,warehouseCode:i,issuerEmployeeNo:o,materialCode:s,fileRow:n+1,issueQuantity:c,issueDate:(0,f.default)(u).isValid()?(0,f.default)(u).format(`YYYY-MM-DD`):t,remark:String(e.remark??``)}})}async function m(e,t){let n=[];for(let r of e)n.push({...r,...await t(r)});return n}function h(e){return Error(`第 ${e+1} 行缺少必填字段或发放数量不是正数`)}function g(e,a){let o=i(),s=d(async t=>(await r(u,{tenantId:e,keyword:t,from:0})).filter(n=>n.tenantId===e&&n.employeeNo===t)),c=d(async n=>(await r(t,{keyword:n,status:`enabled`,from:0})).filter(t=>t.tenantId===e&&t.locationCode===n)),l=d(async t=>(await r(n,{materialCode:t,materialType:a,status:`enabled`,from:0})).filter(n=>n.tenantId===e&&n.materialCode===t));return async e=>{o();let[t,n,r,i]=await Promise.all([s(e.employeeNo,`员工工号：${e.employeeNo}`),s(e.issuerEmployeeNo,`员工工号：${e.issuerEmployeeNo}`),c(e.warehouseCode,`启用仓库编码：${e.warehouseCode}`),l(e.materialCode,`${a===`tool`?`工器具`:`防护用品`}编码：${e.materialCode}`)]);return o(),{employee:t,issuer:n,warehouse:r,material:i}}}function _(e,t,n){let r=e.items.map((e,t)=>`<tr><td>${t+1}</td><td>${o(e.materialName)}</td><td>${o(e.specificationModel||`—`)}</td><td>${o(String(e.issueQuantity))}</td><td>${o(n(e.unit))}</td><td>${o(e.remark||``)}</td></tr>`).join(``);return`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${o(e.issuanceNo)}</title>
  <style>
    body { padding: 32px; color: #1f2937; font: 14px/1.5 sans-serif; }
    h1 { text-align: center; font-size: 22px; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 24px; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px; border: 1px solid #9ca3af; text-align: left; }
    .sign { display: flex; justify-content: space-between; margin-top: 48px; }
    @media screen and (max-width: 640px) {
      body { padding: 12px; }
      .meta { grid-template-columns: 1fr; }
      table { table-layout: fixed; font-size: 11px; }
      th, td { padding: 4px; overflow-wrap: anywhere; }
      .sign { flex-wrap: wrap; gap: 12px 24px; }
    }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${t}发放单</h1>
  <div class="meta">
    <span>单据编号：${o(e.issuanceNo)}</span>
    <span>领用人：${o(e.employeeName)}</span>
    <span>员工工号：${o(e.employeeNo)}</span>
    <span>所属组织：${o(e.organizationName||`—`)}</span>
    <span>发放仓库：${o(e.warehouseName)}</span>
    <span>发放日期：${o(e.issueDate)}</span>
  </div>
  <table>
    <thead><tr><th>序号</th><th>${t}</th><th>规格型号</th><th>发放数量</th><th>单位</th><th>备注</th></tr></thead>
    <tbody>${r}</tbody>
  </table>
  <div class="sign">
    <span>领用人签字：____________</span>
    <span>发放人：${o(e.issuerName)}</span>
    <span>日期：____________</span>
  </div>
</body>
</html>`}function v(e,t,n){s(_(e,t,n),`width=980,height=760`)}export{m as i,g as n,p as r,v as t};