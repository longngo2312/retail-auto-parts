# Builds the Phase II ER diagram (Graphviz DOT) straight from backend/db/schema.sql,
# so the diagram cannot drift from the DDL.
# Run: python docs/er_diagram.py  ->  docs/er_diagram.dot  (render with any Graphviz `dot`)
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ddl = (ROOT / "backend/db/schema.sql").read_text()

# Relationship names for the edge labels, keyed by (child, parent).
VERBS = {
    ("employee", "store"): "employs", ("employee", "role"): "granted to",
    ("customer", "store"): "preferred by", ("category", "category"): "parent of",
    ("part", "category"): "classifies", ("part", "manufacturer"): "makes",
    ("customer_vehicle", "customer"): "owns", ("customer_vehicle", "vehicle"): "instance of",
    ("part_fitment", "part"): "fits", ("part_fitment", "vehicle"): "takes",
    ("inventory", "part"): "stocked as", ("inventory", "store"): "holds",
    ("store_price", "part"): "priced as", ("store_price", "store"): "sets",
    ("inventory_audit", "inventory"): "adjusted by", ("inventory_audit", "employee"): "records",
    ("supplier_part", "supplier"): "offers", ("supplier_part", "part"): "supplied as",
    ("purchase_order", "supplier"): "receives", ("purchase_order", "store"): "stocked by",
    ("purchase_order", "employee"): "raises", ("purchase_order_line", "purchase_order"): "contains",
    ("purchase_order_line", "part"): "ordered as", ("customer_order", "customer"): "places",
    ("customer_order", "store"): "fulfills", ("customer_order", "employee"): "handles",
    ("customer_order_line", "customer_order"): "contains", ("customer_order_line", "part"): "sold as",
    ("payment", "customer_order"): "paid by", ("delivery", "customer_order"): "fulfilled by",
    ("part_return", "customer_order_line"): "returned in", ("part_return", "employee"): "processes",
}
GROUPS = {  # fill colour per subject area
    "#e8f0fb": "store role employee customer",
    "#eaf6ea": "category manufacturer part vehicle customer_vehicle part_fitment",
    "#fff4e0": "inventory store_price inventory_audit",
    "#f3eafa": "supplier supplier_part purchase_order purchase_order_line",
    "#fdeaea": "customer_order customer_order_line payment delivery part_return",
}
fill = {t: c for c, ts in GROUPS.items() for t in ts.split()}

tables, edges = {}, []
for name, body in re.findall(r"CREATE TABLE (\w+) \((.*?)\n\);", ddl, re.S):
    cols, pk, fk, uq = [], set(), set(), set()
    for line in body.split("\n"):
        line = line.split("--")[0].strip().rstrip(",")
        if not line:
            continue
        if m := re.match(r"PRIMARY KEY \((.+)\)", line):
            pk |= {c.strip() for c in m[1].split(",")}
        elif m := re.match(r"FOREIGN KEY \((.+)\) REFERENCES (\w+)", line):
            cs = [c.strip() for c in m[1].split(",")]
            fk |= set(cs)
            edges.append((name, m[2], cs))
        elif m := re.match(r"UNIQUE(?: NULLS NOT DISTINCT)? \((.+)\)", line):
            uq |= {c.strip() for c in m[1].split(",")}
        elif not line.startswith("CHECK"):
            col, typ = line.split()[:2]
            if "PRIMARY KEY" in line:
                pk.add(col)
            if " UNIQUE" in line:
                uq.add(col)
            if m := re.search(r"REFERENCES (\w+)", line):
                fk.add(col)
                edges.append((name, m[1], [col], "NOT NULL" not in line and "PRIMARY KEY" not in line))
            cols.append((col, typ))
    tables[name] = (cols, pk, fk, uq)


def label(name):
    cols, pk, fk, uq = tables[name]
    rows = "".join(
        f'<TR><TD ALIGN="LEFT">{"<B>" + c + "</B>" if c in pk else c}</TD>'
        f'<TD ALIGN="LEFT"><FONT COLOR="#666666">{t}</FONT></TD>'
        f'<TD ALIGN="LEFT"><FONT COLOR="#2b5797">{" ".join(k for k, s in (("PK", pk), ("FK", fk), ("UQ", uq)) if c in s) or " "}</FONT></TD></TR>'
        for c, t in cols)
    return (f'<<TABLE BORDER="1" COLOR="#555555" CELLBORDER="0" CELLSPACING="0" CELLPADDING="3" BGCOLOR="white">'
            f'<TR><TD COLSPAN="3" BGCOLOR="{fill[name]}"><B>{name}</B></TD></TR>{rows}</TABLE>>')


out = ['digraph ER {',
       '  graph [rankdir=TB, splines=ortho, nodesep=0.45, ranksep=0.6, fontname="Arial", pad=0.2];',
       '  node  [shape=plain, fontname="Arial", fontsize=9];',
       '  edge  [dir=both, color="#555555", fontname="Arial", fontsize=8, fontcolor="#333333", arrowsize=0.8];']
out += [f"  {t} [label={label(t)}];" for t in tables]
for child, parent, cs, *opt in edges:
    pk = tables[child][1]
    optional = bool(opt and opt[0])
    identifying = all(c in pk for c in cs)
    tail = "teeodot" if optional else "teetee"                  # parent end: 0..1 or exactly 1
    head = "teeodot" if child == "delivery" else "crowodot"      # child end: 0..1 or zero-or-many
    out.append(f'  {parent} -> {child} [arrowtail={tail}, arrowhead={head}, '
               f'style={"solid" if identifying else "dashed"}, xlabel="{VERBS[(child, parent)]}"];')
out.append("}")
(ROOT / "docs/er_diagram.dot").write_text("\n".join(out))
print(f"{len(tables)} entities, {len(edges)} relationships")
