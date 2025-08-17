import React, { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

function buildQuery(params) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v) q.append(k, v) })
  return q.toString() ? `?${q.toString()}` : ''
}

export default function App() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({ start_date: '', end_date: '' })
  const [form, setForm] = useState({ lorry_number: '', record_date: '', price: '', liters: '' })

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/records${buildQuery(filters)}`)
      const data = await res.json()
      setRecords(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    await fetch(`${API}/api/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setForm({ lorry_number: '', record_date: '', price: '', liters: '' })
    load()
  }

  const del = async (id) => {
    await fetch(`${API}/api/records/${id}`, { method: 'DELETE' })
    load()
  }

  const downloadCsv = () => {
    const a = document.createElement('a')
    a.href = `${API}/api/records/csv${buildQuery(filters)}`
    a.download = 'diesel-records.csv'
    a.click()
  }

  const totalLiters = records.reduce((s, r) => s + Number(r.liters || 0), 0)
  const totalPrice = records.reduce((s, r) => s + Number(r.price || 0), 0)

  return (
    <div className="container">
      <h1>Diesel Tracker</h1>

      <section className="card">
        <h2>Add Record</h2>
        <form onSubmit={submit} className="grid">
          <label>Lorry Number
            <input value={form.lorry_number} onChange={e => setForm({ ...form, lorry_number: e.target.value })} required />
          </label>
          <label>Date
            <input type="date" value={form.record_date} onChange={e => setForm({ ...form, record_date: e.target.value })} required />
          </label>
          <label>Price
            <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
          </label>
          <label>Liters
            <input type="number" step="0.01" value={form.liters} onChange={e => setForm({ ...form, liters: e.target.value })} required />
          </label>
          <button type="submit">Save</button>
        </form>
      </section>

      <section className="card">
        <h2>Filter & Export</h2>
        <form className="row" onSubmit={(e)=>{e.preventDefault(); load()}}>
          <label>Start Date
            <input type="date" value={filters.start_date} onChange={e=>setFilters({...filters, start_date:e.target.value})} />
          </label>
          <label>End Date
            <input type="date" value={filters.end_date} onChange={e=>setFilters({...filters, end_date:e.target.value})} />
          </label>
          <button type="submit">Apply</button>
          <button type="button" onClick={()=>{setFilters({start_date:'', end_date:''}); load()}}>Clear</button>
          <button type="button" onClick={downloadCsv}>Download CSV</button>
        </form>
      </section>

      <section className="card">
        <div className="summary">
          <div><strong>Total records:</strong> {records.length}</div>
          <div><strong>Total liters:</strong> {totalLiters}</div>
          <div><strong>Total price:</strong> {totalPrice.toFixed(2)}</div>
        </div>

        {loading ? <p>Loading...</p> : (
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Lorry</th><th>Date</th><th>Price</th><th>Liters</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.lorry_number}</td>
                  <td>{r.record_date}</td>
                  <td>{r.price}</td>
                  <td>{r.liters}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td><button onClick={()=>del(r.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
