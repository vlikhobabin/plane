## ADDED Requirements

### Requirement: Filter project issues by worklog date range
Система MUST поддерживать в штатном rich filter проектной страницы задач date-range фильтр по дате записи факта часов.

#### Scenario: Show issues with worklogs inside the selected period
- **WHEN** пользователь открывает фильтр задач проекта и задает диапазон дат записи факта
- **THEN** система MUST отобрать только те задачи проекта, у которых есть хотя бы одна неудаленная запись worklog с `log_date` внутри выбранного диапазона

#### Scenario: Exclude issues without worklogs in the selected period
- **WHEN** у задачи нет ни одной неудаленной записи worklog в выбранном диапазоне
- **THEN** система MUST исключить такую задачу из результата во всех layout проектной страницы задач, использующих общий набор issue query results

#### Scenario: Keep unrelated filtering behavior unchanged
- **WHEN** пользователь одновременно применяет фильтр по дате записи факта и другие штатные issue filters
- **THEN** система MUST применить новый фильтр совместно с остальными без изменения семантики существующих фильтров

### Requirement: Show period-specific fact hours when worklog date filter is active
При активном фильтре по дате записи факта значение `Факт` в issue list payload MUST отражать только сумму часов за выбранный диапазон.

#### Scenario: Sum only matching worklogs for the Fact column
- **GIVEN** у задачи есть записи worklog `31.03.2026 = 1h`, `10.04.2026 = 1h`, `20.04.2026 = 1h`
- **AND** пользователь задает фильтр с `01.04.2026` по `30.04.2026`
- **WHEN** задача возвращается в списке задач проекта
- **THEN** система MUST вернуть `actual_hours = 2`

#### Scenario: Preserve full fact hours when filter is not active
- **WHEN** фильтр по дате записи факта не задан
- **THEN** система MUST продолжать возвращать текущее общее значение `actual_hours` по всем неудаленным worklog задачи

### Requirement: Restrict worklog-date filtering to users who can read fact hours
Новый фильтр MUST быть доступен только там, где пользователю разрешено видеть фактические часы задачи.

#### Scenario: Hide worklog-date filter for users without worklog visibility
- **WHEN** пользователь не имеет права читать worklog/фактические часы проекта
- **THEN** система MUST не предлагать ему фильтр по дате записи факта

#### Scenario: Do not leak issue membership through hidden worklog data
- **WHEN** пользователь не имеет права читать worklog/фактические часы проекта
- **THEN** сервер MUST не применять скрытый worklog-date filter к его запросам и MUST не использовать worklog range для изменения состава результата
