## 1. OpenSpec And Product Scope

- [x] 1.1 Зафиксировать продуктовый scope первого релиза как project issues page с фильтрацией по `IssueWorkLog.log_date`.
- [x] 1.2 Подтвердить продуктовое имя фильтра и текст в UI/i18n для EN/RU (`Fact date` / `Дата факта` или согласованный вариант).

## 2. Backend Filtering And Aggregation

- [x] 2.1 Добавить новый разрешенный filter field `worklog_log_date` в `IssueFilterSet` с поддержкой `exact` и `range`.
- [x] 2.2 Реализовать queryset-логику, которая отбирает issue по существованию неудаленных worklog в выбранном диапазоне.
- [x] 2.3 Вынести helper для извлечения активного диапазона `worklog_log_date` из rich filter expression.
- [x] 2.4 Изменить helper аннотации `actual_hours`, чтобы он возвращал сумму часов за диапазон при активном фильтре и полную сумму без фильтра.
- [x] 2.5 Применить обновленную аннотацию во всех project issue list endpoints, которые формируют payload для list/kanban/spreadsheet на проектной странице.

## 3. Frontend Filter Registration

- [x] 3.1 Добавить `worklog_log_date` в `TWorkItemFilterProperty` и связанные rich-filter типы.
- [x] 3.2 Зарегистрировать новый date filter config в `useWorkItemFiltersConfig`.
- [x] 3.3 Показать фильтр только в UI проектной страницы задач и не расширить scope на cycle/module/project view без явного решения.
- [x] 3.4 Ограничить видимость фильтра для пользователей без прав на чтение worklog/факта.

## 4. Data Model, Validation, And Tests

- [x] 4.1 Добавить индекс `IssueWorkLog(issue, log_date)` через migration.
- [x] 4.2 Написать backend-тесты на фильтрацию issue по worklog date range, включая кейс с тремя записями `31.03`, `10.04`, `20.04`.
- [x] 4.3 Написать backend-тесты на периодный пересчет `actual_hours` и на исключение задач без worklog в диапазоне.
- [x] 4.4 Добавить frontend/store coverage на сериализацию rich filter expression с новым полем и на показ фильтра только в нужном контексте.
