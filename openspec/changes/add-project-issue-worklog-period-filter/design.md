## Context

Проектная страница задач уже использует общий rich-filters pipeline:
- frontend serialизует выражение в параметр `filters=<json>`;
- backend `ComplexFilterBackend` валидирует поля через `IssueFilterSet` и строит queryset;
- issue list endpoints аннотируют `actual_hours` через единый helper `get_actual_hours_annotation()`.

Текущая проблема в двух местах:
- в наборе `TWorkItemFilterProperty` нет свойства для фильтрации по `IssueWorkLog.log_date`;
- `actual_hours` всегда считается как сумма всех worklog по задаче без учета активного периода.

`IssueWorkLog` уже является отдельной моделью с soft delete и полем `log_date`, но индексирован только по `issue` и `user`. Для range-фильтра этого недостаточно на больших наборах данных.

## Goals / Non-Goals

**Goals:**
- Добавить новый rich-filter property для проектной страницы задач по дате записи факта.
- Отбирать issue по наличию worklog в заданном диапазоне.
- Возвращать периодную сумму `actual_hours`, если фильтр активен.
- Сохранить совместимость с текущими layout и сериализацией issue results.
- Добавить индекс, который делает range-фильтрацию по worklog приемлемой по стоимости.

**Non-Goals:**
- Не менять issue detail time summary endpoint и UI в деталке задачи.
- Не вводить отдельный reporting endpoint или новый вид аналитики.
- Не расширять первый релиз на cycle/module/workspace issue pages как отдельный продуктовый scope.
- Не менять семантику уже существующих legacy filters.

## Decisions

### 1. Новый filter property: `worklog_log_date`

В rich filters добавляется новое свойство `worklog_log_date` с тем же набором операторов, что и у остальных date filters: `exact` и `range`.

Причины:
- оно явно указывает на источник данных `IssueWorkLog.log_date`;
- не конфликтует с `created_at` issue и не перегружает понятие `fact`;
- напрямую ложится в backend allowlist/filterset.

Frontend-точки:
- `packages/types/src/view-props.ts` для добавления нового `TWorkItemFilterProperty`;
- `apps/web/ce/hooks/work-item-filters/use-work-item-filters-config.tsx` для регистрации filter config;
- `packages/constants/src/issue/filter.ts` или project-specific composition layer для показа фильтра на project issues page.

### 2. Серверная фильтрация идет через `IssueFilterSet`, а не через отдельный endpoint

Новый фильтр добавляется в `IssueFilterSet` как кастомный method filter, который строит `Q` по `worklogs__log_date` и `worklogs__deleted_at__isnull=True`.

Причины:
- это нативно совместимо с существующим `ComplexFilterBackend`;
- новый фильтр участвует в том же `filters=<json>` контракте;
- не требуется отдельный transport или frontend service.

Ожидаемая логика:
- `worklog_log_date__exact` -> issue matches if at least one matching worklog exists on that date;
- `worklog_log_date__range` -> issue matches if at least one matching worklog exists inside the inclusive range.

### 3. `actual_hours` должен зависеть от активного worklog filter range

`get_actual_hours_annotation()` должен принимать опциональный контекст диапазона worklog date и строить одну из двух аннотаций:
- без фильтра: текущее поведение, сумма всех неудаленных worklog;
- с фильтром: сумма только worklog, попавших в диапазон.

Причины:
- колонка `Факт` уже везде читает `issue.actual_hours`, менять UI-рендер не нужно;
- это сохраняет единый source of truth для spreadsheet/list/board payloads.

Практически это значит:
- перед аннотацией issue queryset нужно извлечь активный `worklog_log_date` filter из rich filter expression;
- helper аннотации должен использовать те же границы диапазона, что и сам queryset filter.

### 4. Источник периода: только `IssueWorkLog.log_date`

Фильтр и периодный пересчет используют только бизнес-дату записи факта `log_date`, а не `created_at`.

Причины:
- это соответствует пользовательскому сценарию с апрельскими часами;
- `created_at` технический timestamp, а не дата, за которую учтен факт.

### 5. Первый релиз ограничиваем project issues experience

Продуктово новый фильтр считается поддержанным на project issues page, где пользователь ожидает работать со штатным фильтром списка/доски задач.

Реализация при этом может попасть в общие backend endpoints, но UI-показ фильтра нужно контролировать аккуратно:
- не добавлять его автоматически во все contexts, использующие `ISSUE_DISPLAY_FILTERS_BY_PAGE.issues.filters`, без отдельной проверки;
- если нужно, сформировать project-specific `filtersToShowByLayout`, чтобы не открыть незапланированный scope для cycle/module/project view.

Причины:
- сейчас один и тот же массив filters используется в project, cycle, module и project view roots;
- без ограничения новый фильтр появится шире, чем запрошено продуктом.

### 6. Добавляем составной индекс для worklog period queries

В `IssueWorkLog` добавляется индекс по `(issue, log_date)`.

Причины:
- и фильтрация, и периодная агрегация опираются на `issue_id + log_date range`;
- текущих индексов по `issue` и `user` недостаточно для устойчивой производительности.

## Risks / Trade-offs

- Если добавить filter property в общий `issues.filters`, он появится также в cycle/module/project view UI. Это продуктовый риск расширения scope.
- Периодная аннотация `actual_hours` требует синхронного разбора rich filter expression на сервере. Нужен один общий helper, иначе разные issue endpoints легко разъедутся в поведении.
- Если диапазон будет задан некорректно или частично, нужно либо не применять фильтр, либо валидировать вход так же строго, как остальные date range filters.
- Добавление join/subquery по worklogs без нового индекса может ухудшить время ответа на больших проектах.
