import { SettingsForm } from "@/components/settings-form";
import { Card } from "@/components/ui";
import { getDefaultOrg } from "@/lib/org";
import { getOrgSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const org = await getDefaultOrg();
  const s = await getOrgSettings(org.id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <Card>
        <SettingsForm apiKeyMasked={s.apiKeyMasked} apiKeySource={s.apiKeySource} model={s.model} salesContext={s.salesContext} />
      </Card>
    </div>
  );
}
