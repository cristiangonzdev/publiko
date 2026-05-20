# n8n Workflows

Exports JSON de los workflows descritos en `docs/n8n-workflows.md`.

| File | WF | Trigger |
|---|---|---|
| `wf-01-weekly-ideas.json` | Plan semanal de contenido | Cron lunes 09:00 |
| `wf-02-scheduler.json` | Scheduler de publicación | Cron cada 30 min |
| `wf-03-analytics-harvest.json` | Harvest semanal de métricas | Cron lunes 08:00 |
| `wf-04-onboarding.json` | Setup nuevo cliente | Webhook |
| `wf-05-brutos-ready.json` | Notif al editor | Webhook |
| `wf-06-reviews.json` | Reseñas GMB | Cron diario 10:00 |
| `wf-07-task-assigned.json` | Notif al grabador | Webhook |

Cada export se crea desde n8n (Menu → Download). Se versionan aquí para reproducibilidad.
