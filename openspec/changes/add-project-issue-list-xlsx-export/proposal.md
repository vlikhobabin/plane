## Why

На проектной странице списка задач нет штатного способа выгрузить текущий набор рабочих элементов в Excel с учетом выбранных фильтров и пользовательских настроек отображения. Из-за этого пользователь вынужден собирать данные вручную или пользоваться внешними инструментами, что особенно неудобно для отчетных и операционных сценариев.

## What Changes

- Добавить на project issues page в верхнюю панель действий кнопку-меню `Еще` рядом с существующими действиями списка.
- Сократить label основной кнопки создания с `Добавить рабочий элемент` до `+Добавить`, чтобы освободить место под новое меню.
- Добавить в меню `Еще` пункт `Экспорт в xlsx`.
- При выборе `Экспорт в xlsx` запускать немедленную загрузку Excel-файла для текущего project issue list независимо от активного layout.
- Экспортировать все задачи, попавшие в текущий результат списка с учетом активных фильтров.
- В начале листа выводить summary активных фильтров, затем таблицу задач.
- Всегда включать в экспорт колонки `Название` и `ID/key`, даже если они не входят в набор переключаемых display properties.
- Для layout `calendar` и `gantt_chart` экспортировать минимальный обязательный набор колонок: `Название`, `ID/key`, `Дата начала`, `Дата завершения`.
- Для остальных layout использовать набор колонок из текущих display properties списка с добавлением обязательных колонок.

## Capabilities

### New Capabilities

- `project-issue-list-xlsx-export`: экспорт текущего project issue list в XLSX с учетом активных фильтров, текущих display settings и немедленным стартом загрузки файла.

### Modified Capabilities

- None.

## Impact

- Верхняя панель project issue list в `apps/web/ce/components/issues/header.tsx` и `apps/web/core/components/issues/filters.tsx`.
- Project issues filter/display state в `apps/web/core/store/issue/project/filter.store.ts`.
- Новый project-scoped export endpoint в backend issue/project API.
- Backend issue query/export pipeline и XLSX generation на основе существующего exporter/openpyxl стека.
- UI download flow на frontend через blob download без промежуточного history/export queue сценария.
