interface IssuanceReferenceRecord {
  id: string
  issuanceNo: string
}

interface IssuanceReferencePage<TRecord, TOverview> {
  data: TRecord[]
  total: number
  overview: TOverview
}

interface IssuanceReferenceTarget {
  recordId: string
  recordNo: string
}

/** Locate an exact blocker even when the same document number occurs in another tenant's page. */
export async function fetchIssuanceReference<TRecord extends IssuanceReferenceRecord, TOverview>(
  fetchPage: (params: {
    from: number
    to: number
    keyword: string
    purpose: 'list'
  }) => Promise<IssuanceReferencePage<TRecord, TOverview>>,
  target: IssuanceReferenceTarget,
  resourceLabel: string,
  assertScope: () => void
): Promise<{ record: TRecord; overview: TOverview }> {
  if (!target.recordId || !target.recordNo)
    throw new Error(`关联${resourceLabel}缺少定位信息，请返回存放位置重新检查引用`)

  const pageSize = 100
  for (let from = 0; ;) {
    assertScope()
    const result = await fetchPage({
      from,
      to: from + pageSize - 1,
      keyword: target.recordNo,
      purpose: 'list'
    })
    assertScope()
    if (!Array.isArray(result.data) || !Number.isSafeInteger(result.total) || result.total < 0)
      throw new Error(`关联${resourceLabel}查询结果异常，请返回存放位置重新检查引用`)
    const record = result.data.find(
      (row) => row.id === target.recordId && row.issuanceNo === target.recordNo
    )
    if (record) {
      assertScope()
      return { record, overview: result.overview }
    }
    if (result.data.length === 0 || from + result.data.length >= result.total)
      throw new Error(`关联${resourceLabel}无法定位，请返回存放位置重新检查引用`)
    from += result.data.length
  }
}
