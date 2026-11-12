# dsh-plugin-disk-map — Disk Map

Mide el uso de disco por carpeta y archivo en una ruta local, mostrando los mayores consumidores con profundidad y top configurables.

## Tools

| Tool | Qué hace |
|---|---|
| `status` | Estado |
| `map` | Mapa de disco |

## Instalación

Desde **DSH → Settings → Plugins** instala `github:thegabopacheco-sudo/dsh-plugin-disk-map` y permite el script de instalación.

```
dsh plugin --profile <perfil> add github:thegabopacheco-sudo/dsh-plugin-disk-map
```

## Seguridad

- Lectura por defecto; escritura solo con `confirm:true` y pedido explícito.
- `DSH_DISK_MAP_MODE=read-only` desactiva acciones.
- Listas blancas y auditoría en `<DSH_HOME>\cache\disk-map\audit.jsonl`.

## Licencia

MIT © thegabopacheco-sudo
