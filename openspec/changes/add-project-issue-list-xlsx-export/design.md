## Context

Project issue list в Plane уже имеет верхнюю панель действий, state фильтров и display properties, а также backend/query pipeline для построения текущего набора задач. При этом существующий export flow в продукте решает другую задачу:

- frontend отправляет запрос в workspace-level export endpoint;
- backend создает `ExporterHistory`;
- Celery-task собирает полный экспорт и публикует файл асинхронно.

Этот pipeline не соответствует целевому UX для project issue list:

- пользователь ожидает скачать именно текущий список задач, а не фоновый экспорт по workspace;
- выгрузка должна учитывать активные rich filters и display settings текущей страницы;
- загрузка должна стартовать сразу после выбора действия.

Дополнительно есть уже подтвержденные продуктовые правила:

- `Название` и `ID/key` всегда присутствуют в файле;
- для `calendar` и `gantt_chart` экспортируется минимальный обязательный набор `Название`, `ID/key`, `Дата начала`, `Дата завершения`;
- приложение обеспечивает немедленный старт download, но не гарантирует бесшумное сохранение файла из-за browser settings.

## Goals / Non-Goals

**Goals:**

- Добавить export action в project issue list toolbar без изменения общей логики списка.
- Экспортировать все issue, попавшие в текущий результат project issue list, независимо от активного layout.
- Учитывать активные rich filters и display settings списка при формировании файла.
- Отдавать пользователю готовый XLSX synchronously через direct-download endpoint.
- Положить в workbook summary фильтров и далее табличные данные по согласованным колонкам.

**Non-Goals:**

- Не переиспользовать export history/S3/Celery flow для этой кнопки.
- Не добавлять новый общий reporting UI или настройки export history.
- Не менять существующий async export для других сценариев.
- Не проектировать отдельный mobile-specific action placement в первом релизе.
- Не расширять первый релиз на cycle/module/view pages.

## Decisions

### 1. Отдельный project-scoped direct-download endpoint

Будет добавлен отдельный endpoint для project issue list export, который сразу возвращает XLSX как response body.

Почему так:

- текущий async export endpoint построен вокруг `ExporterHistory` и фоновой задачи, а не вокруг текущего состояния списка;
- direct-download лучше соответствует действию из toolbar;
- это позволяет применять именно текущие project filters/display settings без побочного создания history entries.

Альтернатива:

- переиспользовать существующий workspace export flow.
- отклонено, потому что UX и состав данных не совпадают с задачей.

### 2. Источник данных должен совпадать с project issue list query pipeline

Новый export endpoint будет строить queryset на основе того же project issue filtering pipeline, который используется для списка задач.

Почему так:

- это сохраняет одинаковую семантику между экраном и файлом;
- не потребуется отдельная логика фильтрации на frontend;
- export автоматически учитывает новые фильтры, если они уже поддерживаются project issue list.

Альтернатива:

- собирать весь набор issue на frontend и экспортировать его из браузера.
- отклонено, потому что это дублирует backend filtering, осложняет пагинацию и требует новой xlsx-зависимости в web app.

### 3. Summary активных фильтров формируется на frontend и передается в export request

Frontend будет собирать человекочитаемое summary активных фильтров и передавать его как часть export payload.

Почему так:

- на frontend уже есть доступ к label/operator/value representation rich filters;
- backend не должен повторно собирать UI-friendly текст для labels, states, users, cycles, modules и других reference values;
- это упрощает xlsx generation и уменьшает связность между backend и rich filter UI config.

Альтернатива:

- собирать summary целиком на backend.
- отклонено, потому что это потребует дублирования логики label resolution.

### 4. Колонки export определяются через нормализованный column contract, а не буквально по layout UI

Backend export будет принимать нормализованный список колонок, собранный frontend по следующему правилу:

- для `list`, `kanban`, `spreadsheet`: `Название` и `ID/key` всегда включены, остальные колонки берутся из текущих display properties;
- для `calendar` и `gantt_chart`: экспортируется фиксированный минимальный набор `Название`, `ID/key`, `Дата начала`, `Дата завершения`.

Почему так:

- `Название` не входит в текущий набор toggleable display properties, но продуктово обязательно;
- `calendar` и `gantt_chart` сейчас имеют урезанные display properties, которые не дают полезного экспорта;
- column contract становится явным и тестируемым.

Альтернатива:

- буквально использовать только layout display properties.
- отклонено, потому что это дает неполезный файл для `calendar` и `gantt_chart` и исключает `Название`.

### 5. Генерация XLSX остается на backend поверх существующего openpyxl стека

Файл будет собираться на backend с помощью уже существующего `openpyxl`-based formatter или рядом с ним, без новой browser-side xlsx библиотеки.

Почему так:

- зависимость для XLSX уже есть на backend;
- backend проще контролирует формат, filename и табличную структуру;
- workbook с metadata rows и таблицей проще собирать на сервере, чем в браузере.

Альтернатива:

- добавить `xlsx`/`exceljs` в web app и генерировать файл клиентом.
- отклонено, потому что это увеличивает вес фронта и дублирует export logic.

### 6. UI change ограничивается project issue toolbar

Изменения в toolbar делаются локально в project issue header и adjacent filters toolbar:

- label create button меняется только в этой точке на `+Добавить`;
- `Еще` добавляется рядом с `Отображение` и `Аналитика`.

Почему так:

- текущий translation key `issue.add.label` переиспользуется в других местах и не должен меняться глобально;
- feature запрошена именно для project issue list.

Альтернатива:

- менять translation или shared header globally.
- отклонено, потому что это расширяет scope и создает побочные изменения в других flows.

## Risks / Trade-offs

- [Риск] Экспорт и экран разъедутся по фильтрам или сортировке. → Митигировать через reuse того же project issue query pipeline и явные integration tests на совпадение набора issue.
- [Риск] Сборка человекочитаемого filter summary на frontend может разойтись с backend semantics. → Передавать в backend и raw filters, и готовый summary; backend использовать filters для queryset, summary только для workbook header.
- [Риск] Синхронный XLSX export может быть тяжелым на очень больших проектах. → Ограничить первый релиз project issue list scope, использовать lean export schema вместо полного issue export, профилировать response time.
- [Риск] Браузер может показать download prompt или изменить место сохранения файла. → В продуктовой формулировке обещать только немедленный старт download, а не silent save.
- [Риск] Calendar/gantt column semantics могут отличаться от ожиданий других команд. → Зафиксировать в spec отдельное правило для этих двух layout и покрыть тестами.

## Migration Plan

1. Добавить новый project-scoped export endpoint и lean export schema.
2. Добавить toolbar action `Еще -> Экспорт в xlsx` и локально сократить label create button.
3. Протестировать list/kanban/spreadsheet/calendar/gantt на единый экспортный contract.
4. Задеплоить без миграции пользовательских настроек, так как feature читает уже существующие filters/display properties.
5. В случае rollback удалить новый toolbar action и endpoint без затрагивания существующего async export flow.

## Open Questions

- None.
