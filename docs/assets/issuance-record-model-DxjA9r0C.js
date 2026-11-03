import{o as e}from"./rolldown-runtime-C0FnF6B9.js";import{Bn as t,Pr as n,Vo as r}from"./api-EFKsw-qA.js";import{Ct as i,dt as a}from"./sys-DxCOp47S.js";import{n as o,t as s}from"./print-document-CH2oGZwk.js";import{t as c}from"./dayjs.min-CbsKVrjN.js";import{t as l}from"./normalize-D-z-YgyD.js";import{r as u}from"./employees-DOZsya58.js";import{t as d}from"./import-reference-C2D2S4j7.js";async function f(e,t,n,r){if(!t.recordId||!t.recordNo)throw Error(`关联${n}缺少定位信息，请返回存放位置重新检查引用`);for(let i=0;;){r();let a=await e({from:i,to:i+100-1,keyword:t.recordNo,purpose:`list`});if(r(),!Array.isArray(a.data)||!Number.isSafeInteger(a.total)||a.total<0)throw Error(`关联${n}查询结果异常，请返回存放位置重新检查引用`);let o=a.data.find(e=>e.id===t.recordId&&e.issuanceNo===t.recordNo);if(o)return r(),{record:o,overview:a.overview};if(a.data.length===0||i+a.data.length>=a.total)throw Error(`关联${n}无法定位，请返回存放位置重新检查引用`);i+=a.data.length}}var p=e(c(),1);function m(e,t=(0,p.default)().format(`YYYY-MM-DD`)){return e.map((e,n)=>{if(!i(e))throw g(n);let r=String(e.employeeNo??``).trim(),a=String(e.warehouseCode??``).trim(),o=String(e.issuerEmployeeNo??``).trim(),s=String(e.materialCode??``).trim(),c=l(e.issueQuantity);if(!r||!a||!o||!s||c===null||c<=0)throw g(n);let u=String(e.issueDate??``);return{employeeNo:r,warehouseCode:a,issuerEmployeeNo:o,materialCode:s,fileRow:n+1,issueQuantity:c,issueDate:(0,p.default)(u).isValid()?(0,p.default)(u).format(`YYYY-MM-DD`):t,remark:String(e.remark??``)}})}async function h(e,t){let n=[];for(let r of e)n.push({...r,...await t(r)});return n}function g(e){return Error(`第 ${e+1} 行缺少必填字段或发放数量不是正数`)}function _(e,i){let o=a(),s=d(async t=>(await r(u,{tenantId:e,keyword:t,from:0})).filter(n=>n.tenantId===e&&n.employeeNo===t)),c=d(async n=>(await r(t,{keyword:n,status:`enabled`,from:0})).filter(t=>t.tenantId===e&&t.locationCode===n)),l=d(async t=>(await r(n,{materialCode:t,materialType:i,status:`enabled`,from:0})).filter(n=>n.tenantId===e&&n.materialCode===t));return async e=>{o();let[t,n,r,a]=await Promise.all([s(e.employeeNo,`员工工号：${e.employeeNo}`),s(e.issuerEmployeeNo,`员工工号：${e.issuerEmployeeNo}`),c(e.warehouseCode,`启用仓库编码：${e.warehouseCode}`),l(e.materialCode,`${i===`tool`?`工器具`:`防护用品`}编码：${e.materialCode}`)]);return o(),{employee:t,issuer:n,warehouse:r,material:a}}}function v(e,t,n){let r=e.items.map((e,t)=>`<tr><td>${t+1}</td><td>${o(e.materialName)}</td><td>${o(e.specificationModel||`—`)}</td><td>${o(String(e.issueQuantity))}</td><td>${o(n(e.unit))}</td><td>${o(e.remark||``)}</td></tr>`).join(``);return`<!doctype html>
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
</html>`}function y(e,t,n){s(v(e,t,n),`width=980,height=760`)}function b(e,t,n,r,i){return{id:t,tenantId:e,employeeNo:n,employeeName:r,jobTitle:i,employmentStatus:`active`}}function x(e,t){let{copy:n,today:r,materialType:i}=t;return{form:{id:n?void 0:e.id,issuanceNo:n?``:e.issuanceNo,employeeId:e.employeeId,warehouseId:e.warehouseId,issuerEmployeeId:e.issuerEmployeeId,issueDate:n?r:e.issueDate,remark:e.remark||``,items:e.items.map(e=>({...e,id:void 0}))},selection:{employee:[b(e.tenantId,e.employeeId,e.employeeNo,e.employeeName,e.positionName)],issuer:[b(e.tenantId,e.issuerEmployeeId,``,e.issuerName)],warehouse:[{id:e.warehouseId,tenantId:e.tenantId,organizationId:e.organizationId||``,locationCode:``,locationName:e.warehouseName,status:`enabled`,childCount:0,organization:{id:e.organizationId||``,organizationCode:``,organizationName:e.organizationName||``}}],materialIds:e.items.map(e=>e.materialId),materials:e.items.map(t=>({id:t.materialId,tenantId:e.tenantId,materialCode:``,materialName:t.materialName,categoryId:``,category:{id:``,categoryCode:``,categoryName:t.materialCategory||``},specificationModel:t.specificationModel,drawingNo:null,basicUnit:t.unit,materialType:i,materialSource:`purchase`,brand:null,materialComposition:null,placeOfOrigin:null,imageUrls:[],description:null,status:`enabled`,sort:10}))}}}export{m as a,_ as i,x as n,h as o,y as r,f as s,b as t};