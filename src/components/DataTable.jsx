import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Trash2,
  SlidersHorizontal, ArrowUpNarrowWide, ArrowDownNarrowWide, Check, CornerDownRight,
} from 'lucide-react';

// ─── formatters ────────────────────────────────────────────────────────────────

export const money=(n,code='RWF')=>{
  const v=Number(n)||0;
  if(!code) return new Intl.NumberFormat('en-RW').format(v);
  if(code==='RWF') return new Intl.NumberFormat('en-RW').format(v)+' RWF';
  return new Intl.NumberFormat('en',{style:'currency',currency:code}).format(v);
};

// ─── status pill tones ─────────────────────────────────────────────────────────

const TONE_STYLES={
  good:{pill:'bg-emerald-100 text-emerald-700 border border-emerald-300'},
  susp:{pill:'bg-amber-100 text-amber-700 border border-amber-300'},
  bad:{pill:'bg-rose-100 text-rose-700 border border-rose-300'},
  info:{pill:'bg-indigo-100 text-indigo-700 border border-indigo-300'},
  neutral:{pill:'bg-slate-100 text-slate-500 border border-slate-200'},
};

// Canonical form → tone map. Lookup normalizes any casing/underscoring so
// badges resolve a color instead of falling back to gray (e.g. "ACTIVE",
// "Suspend", "Suspended", "INVESTIGATE" all map to their correct tone).
const TONE_BY_LABEL={
  good:['active','completed','released','approved','published','paid','available','success','delivered'],
  susp:['suspend','suspended','pending','processing','held','under review','draft','open'],
  bad:['block','blocked','rejected','cancelled','failed','on hold','frozen'],
  info:['investigate','investigation'],
};

export const toneOf=(label='')=>{
  const c=String(label).toLowerCase().replace(/[_\s-]+/g,' ').trim();
  const key=Object.keys(TONE_BY_LABEL).find(k=>TONE_BY_LABEL[k].includes(c));
  return key||'neutral';
};

export function StatusPill({label}){
  const meta=TONE_STYLES[toneOf(label)]||TONE_STYLES.neutral;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.pill}`}>
      {label}
    </span>
  );
}

// Keeps a local copy of the status label so the pill's text (and tone) reflect
// incoming prop changes immediately — even if the parent's row data arrives
// async (refetch), the cell never shows a stale label.
export function LiveStatus({label}){
  const [current,setCurrent]=useState(label);

  useEffect(()=>{
    setCurrent(label);
  },[label]);

  return <StatusPill label={current}/>;
}

// ─── default status menu options ───────────────────────────────────────────────

export const STATUS_MENU_OPTIONS=[
  {value:'Active',menuText:'text-emerald-600',hover:'hover:bg-slate-100'},
  {value:'Suspend',menuText:'text-amber-600',hover:'hover:bg-slate-100'},
  {value:'Block',menuText:'text-rose-600',hover:'hover:bg-slate-100'},
  {value:'Investigate',menuText:'text-indigo-600',hover:'hover:bg-slate-100'},
];

// ─── small building blocks ─────────────────────────────────────────────────────

function RowCheckbox({checked,indeterminate,onChange,label}){
  const ref=useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.indeterminate=!!indeterminate&&!checked; },[indeterminate,checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={e=>onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900"
    />
  );
}

function AvatarRow({data}){
  if(!data) return null;
  const {src,name,initials,subtitle}=data;
  return (
    <div className="flex items-center gap-3">
      {src
        ? <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200"><img src={src} alt={name} className="h-full w-full object-cover"/></span>
        : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{initials||(name||'?').slice(0,2).toUpperCase()}</span>}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{name}</div>
        {subtitle&&<div className="truncate text-xs text-slate-400">{subtitle}</div>}
      </div>
    </div>
  );
}

function useOutsideClose(open,ref,onClose){
  useEffect(()=>{
    if(!open)return;
    const handler=e=>{ if(ref.current&&!ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[open,ref,onClose]);
}

const MENU_BTN='flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-normal text-left transition-colors';

// ─── DataTable ─────────────────────────────────────────────────────────────────

export default function DataTable({
  columns=[],
  rows=[],
  rowKey=r=>r.id,
  filters,                 // [{key,label,filter(rows)}]
  activeFilter,
  onFilterChange,
  searchable=true,
  searchKeys,
  searchPlaceholder='Search…',
  filterOptions,           // [{key,label,filter(rows)}] → Filter ▾ dropdown
  sortableColumns,         // [{key,label}]
  sortAccessor,            // (row,key)=>value
  avatar,                  // fn(r)->{src?,name,initials?,subtitle?}
  status,                  // fn(r)->label | {label}
  statusOptions=STATUS_MENU_OPTIONS,
  onStatusChange,
  onSaveStatuses,          // fn([{row,status}]) → persists the staged statuses ("make it real")
  actions,                 // fn(r)->inline icon buttons (optional)
  menuItems,               // fn(r)->[{label,icon?,className?,onClick?}] extra menu entries
  selectable=true,
  onBulkDelete,
  bulkActions,             // [{icon,title,className?,onClick(rows)}]
  pageSizeOptions=[10,20,50],
  defaultPageSize=10,
  emptyText='No records found',
  className='',
  rowClassName,
  tableClassName,
}){
  const [q,setQ]=useState('');
  const [filterDrop,setFilterDrop]=useState(filterOptions?.[0]?.key);
  const [openDrop,setOpenDrop]=useState(null); // 'filter' | 'sort'
  const [sortKey,setSortKey]=useState(null);
  const [sortDir,setSortDir]=useState('asc');
  const [pageState,setPageSize]=useState(1);
  const [per,setPer]=useState(defaultPageSize);
  const [selected,setSelected]=useState({});
  const [openMenu,setOpenMenu]=useState(null); // rowKey of open row menu
  const [menuPos,setMenuPos]=useState({left:0,top:0});
  const [menuRow,setMenuRow]=useState(null);   // row object whose menu is open
  const [draftStatus,setDraftStatus]=useState({}); // rowKey -> staged status label (optimistic)
  const [softDeleted,setSoftDeleted]=useState({}); // rowKey -> true (optimistic removal)
  const toolbarRef=useRef(null);
  const menuRef=useRef(null);
  const menuAnchorRef=useRef(null);

  useOutsideClose(openDrop,toolbarRef,()=>setOpenDrop(null));
  useOutsideClose(openMenu,menuRef,()=>closeMenu());

  const draftCount=Object.keys(draftStatus).length;

  // Reconcile: drop soft-deleted keys once parent confirms removal (row gone from rows)
  useEffect(()=>{
    setSoftDeleted(prev=>{
      const keys=Object.keys(prev);
      if(!keys.length) return prev;
      const rowSet=new Set(rows.map(rowKey));
      const next={...prev};
      let ch=false;
      keys.forEach(k=>{ if(!rowSet.has(k)){delete next[k];ch=true;} });
      return ch?next:prev;
    });
  },[rows]);

  // Visible rows (hide soft-deleted instantly)
  const activeRows=useMemo(()=>rows.filter(r=>!softDeleted[rowKey(r)]),[rows,softDeleted,rowKey]);

  // ── pipeline ──
  const filtered=useMemo(()=>{
    let out=activeRows;
    if(activeFilter&&filters){const f=filters.find(x=>x.key===activeFilter); if(f?.filter) out=f.filter(out);}
    if(filterDrop&&filterOptions){const f=filterOptions.find(x=>x.key===filterDrop); if(f?.filter) out=f.filter(out);}
    if(q.trim()&&searchable){
      const needle=q.trim().toLowerCase();
      const keys=searchKeys&&searchKeys.length?searchKeys:null;
      out=out.filter(r=>{
        const fields=keys
          ? keys.map(k=>typeof k==='function'?k(r):(r[k]??''))
          : Object.values(r);
        return fields.some(v=>String(v??'').toLowerCase().includes(needle));
      });
    }
    if(sortKey){
      out=[...out].sort((a,b)=>{
        const va=sortAccessor?sortAccessor(a,sortKey):a[sortKey];
        const vb=sortAccessor?sortAccessor(b,sortKey):b[sortKey];
        const cmp=typeof va==='number'&&typeof vb==='number'?va-vb:String(va??'').localeCompare(String(vb??''));
        return sortDir==='asc'?cmp:-cmp;
      });
    }
    return out;
  },[activeRows,filters,activeFilter,filterDrop,q,searchable,searchKeys,sortKey,sortDir,sortAccessor]);

  // ── pagination ──
  const total=filtered.length;
  const totalPages=Math.max(1,Math.ceil(total/per));
  const page=Math.min(pageState,totalPages);
  const start=total===0?0:(page-1)*per+1;
  const end=Math.min(total,page*per);
  const shown=filtered.slice((page-1)*per,end);

  // ── selection ──
  const selectedCount=Object.values(selected).filter(Boolean).length;
  const allSelected=shown.length>0&&shown.every(r=>selected[rowKey(r)]);
  const someSelected=shown.some(r=>selected[rowKey(r)]);
  const toggleRow=r=>setSelected(p=>({...p,[rowKey(r)]:!p[rowKey(r)]}));
  const toggleAll=()=>{
    setSelected(p=>{
      const next={...p};
      if(allSelected||someSelected){ shown.forEach(r=>{delete next[rowKey(r)];}); }
      else{ shown.forEach(r=>{ next[rowKey(r)]=true; }); }
      return next;
    });
  };
  const clearSelection=()=>setSelected({});
  const selectedRows=filtered.filter(r=>selected[rowKey(r)]);
  const handleBulkDelete=()=>{
    const keys={};
    selectedRows.forEach(r=>{keys[rowKey(r)]=true;});
    setSoftDeleted(p=>({...p,...keys}));
    clearSelection();
    if(onBulkDelete) onBulkDelete(selectedRows);
  };

  const rowStatus=r=>{
    if(!status) return null;
    const s=status(r);
    return typeof s==='string'?s:(s?.label??null);
  };
  const sortBtnLabel=()=>{
    if(!sortKey) return 'Sort';
    const found=sortableColumns?.find(c=>c.key===sortKey);
    return found?.label??sortKey;
  };

  // When the real (parent/backend) status catches up with a staged draft, drop the
  // draft so a later server refresh never shows a stale value.
  useEffect(()=>{
    setDraftStatus(prev=>{
      if(!Object.keys(prev).length) return prev;
      const next={...prev};
      let changed=false;
      for(const r of rows){
        const key=rowKey(r);
        const actual=rowStatus(r);
        if(next[key]!==undefined&&actual&&next[key]===actual){ delete next[key]; changed=true; }
      }
      return changed?next:prev;
    });
  },[rows,status,rowKey]);

  const MENU_W=192;
  const menuEstH=(row)=>{
    const items=(menuItems?.(row))?.length||0;
    const st=statusOptions?.length||0;
    return 24+items*32+st*32+(items&&st?12:0);
  };

  const repositionMenu=()=>{
    const el=menuAnchorRef.current;
    if(!el||!menuRow) return;
    const rect=el.getBoundingClientRect();
    const h=menuEstH(menuRow);
    const pad=8, gap=6;
    const openDown=(rect.bottom+gap+h)<=window.innerHeight-pad||rect.top<=h+gap;
    const left=Math.min(Math.max(pad,rect.right-MENU_W),window.innerWidth-MENU_W-pad);
    setMenuPos({
      left,
      ...(openDown
        ?{top:rect.bottom+gap}
        :{bottom:window.innerHeight-rect.top+gap}),
    });
  };

  const closeMenu=()=>{setOpenMenu(null);setMenuRow(null);};

  const openRowMenu=(key,row,ev)=>{
    if(openMenu===key){ closeMenu(); return; }
    menuAnchorRef.current=ev.currentTarget;
    const rect=ev.currentTarget.getBoundingClientRect();
    const h=menuEstH(row);
    const pad=8, gap=6;
    const openDown=(rect.bottom+gap+h)<=window.innerHeight-pad||rect.top<=h+gap;
    const left=Math.min(Math.max(pad,rect.right-MENU_W),window.innerWidth-MENU_W-pad);
    setMenuRow(row);
    setMenuPos({
      left,
      ...(openDown
        ?{top:rect.bottom+gap}
        :{bottom:window.innerHeight-rect.top+gap}),
    });
    setOpenMenu(key);
  };

  useEffect(()=>{
    if(!openMenu) return;
    const handle=()=>repositionMenu();
    window.addEventListener('scroll',handle,true);
    window.addEventListener('resize',handle);
    return()=>{window.removeEventListener('scroll',handle,true);window.removeEventListener('resize',handle);};
  },[openMenu,menuRow]);

  const stageStatus=(key,row,value)=>{
    setDraftStatus(p=>({...p,[key]:value}));
    onStatusChange?.(value,row);
  };

  const saveDrafts=()=>{
    if(!onSaveStatuses||!draftCount) return;
    const entries=rows
      .filter(r=>draftStatus[rowKey(r)]!==undefined)
      .map(r=>({row:r,status:draftStatus[rowKey(r)]}));
    onSaveStatuses(entries);
    setDraftStatus({});
  };

  const resetToPage1=()=>setPageState(1);

  return (
    <>
    <div className={`w-full rounded-2xl border-1 border-slate-100 bg-white shadow-sm ${tableClassName||className}`}>
      {/* ── header toolbar ── */}
      {(filters?.length||searchable||filterOptions?.length||sortableColumns?.length)&&(
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3" ref={toolbarRef}>
          {filters?.length?(
            <div className="flex flex-wrap items-center gap-1">
              {filters.map(f=>(
                <button
                  key={f.key}
                  onClick={()=>{onFilterChange?.(f.key);resetToPage1();}}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    activeFilter===f.key
                      ?'bg-slate-900 text-white shadow-sm'
                      :'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ):<div/>}

          <div className="flex items-center gap-2">
            {searchable&&(
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/>
                <input
                  value={q}
                  onChange={e=>{setQ(e.target.value);resetToPage1();}}
                  placeholder={searchPlaceholder}
                  className="w-52 rounded-lg border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                />
              </div>
            )}

            {filterOptions?.length?(
              <div className="relative">
                <button
                  onClick={()=>setOpenDrop(openDrop==='filter'?null:'filter')}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-normal transition-colors ${
                    openDrop==='filter'
                      ?'border-slate-200 bg-white text-slate-900'
                      :'border-slate-200/60 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4"/>
                  {filterOptions.find(o=>o.key===filterDrop)?.label??'Filter'}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400"/>
                </button>
                {openDrop==='filter'&&(
                  <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-slate-100 bg-white p-1.5 shadow-md shadow-slate-100/80">
                    {filterOptions.map(o=>(
                      <button
                        key={o.key}
                        onClick={()=>{setFilterDrop(o.key);setOpenDrop(null);resetToPage1();}}
                        className={`${MENU_BTN} ${filterDrop===o.key?'bg-slate-50 text-slate-900':'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        <span className="flex-1">{o.label}</span>
                        {filterDrop===o.key&&<Check className="h-4 w-4 text-slate-900"/>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ):null}

            {sortableColumns?.length?(
              <div className="relative">
                <button
                  onClick={()=>setOpenDrop(openDrop==='sort'?null:'sort')}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-normal transition-colors ${
                    openDrop==='sort'
                      ?'border-slate-200 bg-white text-slate-900'
                      :'border-slate-200/60 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {sortDir==='asc'
                    ?<ArrowUpNarrowWide className="h-4 w-4"/>
                    :<ArrowDownNarrowWide className="h-4 w-4"/>}
                  {sortBtnLabel()}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400"/>
                </button>
                {openDrop==='sort'&&(
                  <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-slate-100 bg-white p-1.5 shadow-md shadow-slate-100/80">
                    <p className="px-3 py-1 text-xs font-normal uppercase tracking-wide text-slate-400">Sort by</p>
                    {sortableColumns.map(c=>(
                      <button
                        key={c.key}
                        onClick={()=>{setSortKey(k=>{ if(sortKey===c.key){setSortDir(d=>d==='asc'?'desc':'asc');} else {setSortDir('asc');} return c.key;});}}
                        className={`${MENU_BTN} ${sortKey===c.key?'bg-slate-50 text-slate-900':'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                      >
                        <span className="flex-1">{c.label}</span>
                        {sortKey===c.key&&(sortDir==='asc'?<ArrowUpNarrowWide className="h-3.5 w-3.5"/>:<ArrowDownNarrowWide className="h-3.5 w-3.5"/>)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ):null}
          </div>
        </div>
      )}

      {/* ── table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
              {selectable&&(
                <th className="w-10 py-3 pl-4 pr-2">
                  <RowCheckbox label="Select all" checked={allSelected} indeterminate={someSelected&&!allSelected} onChange={toggleAll}/>
                </th>
              )}
              {avatar&&<th className="py-3 px-4">User</th>}
              {columns.map(c=>(
                <th key={c.key} className={`whitespace-nowrap px-4 py-3 ${c.align==='right'?'text-right':''} ${c.width?`w-[${c.width}]`:''}`}>{c.label}</th>
              ))}
              {status&&<th className="whitespace-nowrap px-4 py-3">Status</th>}
              {(actions||menuItems||statusOptions?.length)&&(
                <th className="whitespace-nowrap py-3 pl-4 pr-4 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {shown.length===0?(
              <tr>
                <td colSpan={selectable?columns.length+(avatar?1:0)+(status?1:0)+2:columns.length+(avatar?1:0)+(status?1:0)+1} className="px-4 py-12 text-center text-sm text-slate-400">
                  <CornerDownRight className="mx-auto mb-2 h-5 w-5 text-slate-300"/>
                  {emptyText}
                </td>
              </tr>
            ):shown.map((r,i)=>{
              const key=rowKey(r);
              const isSel=!!selected[key];
              const sLabel=rowStatus(r);
              const shownStatus=draftStatus[key]||sLabel;
              return (
                <tr key={key ?? i} className={`border-0 bg-white outline-none transition-colors ${rowClassName?rowClassName(r):''} ${isSel?'bg-slate-100':'hover:bg-slate-100'}`}>
                  {selectable&&(
                    <td className="py-3 pl-4 pr-2">
                      <RowCheckbox label="Select row" checked={isSel} onChange={()=>toggleRow(r)}/>
                    </td>
                  )}
                  {avatar&&<td className="whitespace-nowrap px-4 py-3"><AvatarRow data={avatar(r)}/></td>}
                  {columns.map(c=>(
                    <td key={c.key} className={`max-w-[260px] border-0 px-4 py-3 text-sm outline-none ${c.align==='right'?'text-right':''}`}>
                      {c.render
                        ? c.render(r)
                        : (
                            <span className={c.align==='right'?'whitespace-nowrap font-medium tabular-nums text-slate-700':'truncate text-slate-700'}>
                              {r[c.key] ?? '—'}
                            </span>
                          )}
                    </td>
                  ))}
                  {status&&(
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        onClick={e=>openRowMenu(key,r,e)}
                        className="rounded-full outline-none border-1 bg-transparent transition-colors duration-150 hover:bg-slate-100"
                        title="Change status"
                      >
                        <LiveStatus label={shownStatus||'—'}/>
                      </button>
                    </td>
                  )}
                  {(actions||menuItems||statusOptions?.length)&&(
                    <td className="relative whitespace-nowrap py-3 pl-4 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {actions&&<div className="flex items-center gap-1">{actions(r)}</div>}
                        {(menuItems||statusOptions?.length)&&(
                          <button
                            onClick={e=>openRowMenu(key,r,e)}
                            className="rounded-lg p-1.5 outline-none border-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            title="Actions"
                          >
                            <MoreHorizontal className="h-4 w-4"/>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── floating bulk action bar ── */}
      {selectable&&selectedCount>0&&(
        <div className="sticky bottom-3 z-30 mx-4 mb-3 -mt-1 flex items-center justify-between rounded-xl border border-slate-200/60 bg-white/95 px-4 py-2 shadow-md shadow-slate-100/80 backdrop-blur">
          <span className="text-sm font-medium text-slate-700">{selectedCount} selected</span>
          <div className="flex items-center gap-1">
            {bulkActions?.map((b,idx)=>(
              <button key={idx} onClick={()=>{b.onClick?.(selectedRows);clearSelection();}} className={`rounded-lg p-1.5 outline-none border-1 text-slate-400 transition-colors duration-150 ${b.className||'hover:bg-slate-50 hover:text-slate-700'}`} title={b.title}>{b.icon}</button>
            ))}
            {onBulkDelete&&(
              <button
                onClick={handleBulkDelete}
                className="rounded-lg p-1.5 outline-none border-1 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-rose-600"
                title="Delete selected"
              >
                <Trash2 className="h-4 w-4"/>
              </button>
            )}
            <button onClick={clearSelection} className="ml-1 outline-none border text-xs font-light text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-500">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── footer pagination ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3">
          {onSaveStatuses&&draftCount>0&&(
            <button
              onClick={saveDrafts}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-normal text-white transition-colors hover:bg-slate-800"
              title="Save status changes"
            >
              <Check className="h-3.5 w-3.5"/>
              Save {draftCount} change{draftCount>1?'s':''}
            </button>
          )}
          <span className="text-sm tabular-nums text-slate-500">
            {total===0?'0 results':`${start}–${end} of ${total}`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Results per page
            <select
              value={per}
              onChange={e=>{setPer(Number(e.target.value));setPageState(1);}}
              className="cursor-pointer rounded-lg border border-slate-200/60 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-white"
            >
              {pageSizeOptions.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1.5">
            <button
              onClick={()=>setPageState(p=>Math.max(1,p-1))}
              disabled={page<=1}
              className="rounded-lg border border-slate-200/60 p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4"/>
            </button>
            <span className="min-w-[44px] text-center text-sm font-medium tabular-nums text-slate-700">{page}/{totalPages}</span>
            <button
              onClick={()=>setPageState(p=>Math.min(totalPages,p+1))}
              disabled={page>=totalPages}
              className="rounded-lg border border-slate-200/60 p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4"/>
            </button>
          </div>
        </div>
      </div>
    </div>

      {openMenu&&menuRow&&createPortal(
        <div ref={menuRef} style={menuPos} className="fixed z-[9999] w-48 rounded-xl border border-slate-100 bg-white p-1.5 text-left shadow-md shadow-slate-100/80">
          {(menuItems?.(menuRow)||[]).map(item=>(
            <button key={item.label} onClick={()=>{item.onClick?.();closeMenu();}} className={`${MENU_BTN} ${item.className||'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
          {!!(menuItems?.(menuRow)||[]).length&&!!statusOptions?.length&&<div className="my-1 h-px bg-slate-100"/>}
          {statusOptions.map(opt=>(
            <button
              key={opt.value}
              onClick={()=>{stageStatus(openMenu,menuRow,opt.value);closeMenu();}}
              className={`${MENU_BTN} ${opt.menuText||'text-slate-600'} ${opt.hover||'hover:bg-slate-50'}`}
            >
              {opt.label||opt.value}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// convenience export so callers can render plain pills independently if needed
export {StatusPill as Pill};