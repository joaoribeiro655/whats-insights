import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, sellers } from "@/db";
import { NewSellerForm } from "@/components/new-seller-form";
import { Card, Empty, StatusBadge } from "@/components/ui";
import { fmtRelative } from "@/lib/format";
import { getDefaultOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function SellersPage() {
  const org = await getDefaultOrg();
  const rows = await db.select().from(sellers).where(eq(sellers.orgId, org.id)).orderBy(asc(sellers.name));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Vendedores</h1>
        <NewSellerForm />
      </div>
      <Card>
        {rows.length === 0 ? <Empty>Nenhum vendedor ainda. Adicione um acima e leia o QR code no celular dele.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 text-left"><tr><th className="py-1">Nome</th><th>Status</th><th>Número</th><th>Atualizado</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-zinc-100">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="text-zinc-600">{s.phone ? `+${s.phone}` : "–"}</td>
                  <td className="text-zinc-400 text-xs">{fmtRelative(s.lastStatusAt)}</td>
                  <td className="text-right"><Link href={`/vendedores/${s.id}`} className="text-xs underline">{s.status === "open" ? "detalhes" : "conectar"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
