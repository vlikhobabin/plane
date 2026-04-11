## 1. Toolbar UI

- [x] 1.1 Локально изменить label primary create button в project issue header на `+Добавить`, не меняя глобальный translation key.
- [x] 1.2 Добавить в toolbar project issue list кнопку-меню `Еще` с chevron icon рядом с существующими actions списка.
- [x] 1.3 Добавить в меню `Еще` пункт `Экспорт в xlsx` и связать его с frontend export handler.

## 2. Frontend Export Request

- [x] 2.1 Собрать из project issue filter store текущие rich filters, display filters и display properties для export payload.
- [x] 2.2 Реализовать frontend helper, который нормализует набор экспортируемых колонок по agreed rules для `list`, `kanban`, `spreadsheet`, `calendar`, `gantt_chart`.
- [x] 2.3 Реализовать frontend helper, который строит человекочитаемое summary активных фильтров для workbook header.
- [x] 2.4 Добавить service method для вызова нового project-scoped export endpoint и скачивания ответа как `blob` с немедленным стартом download.

## 3. Backend Export Endpoint And Workbook Generation

- [x] 3.1 Добавить новый project-scoped direct-download endpoint для XLSX export текущего project issue list.
- [x] 3.2 Переиспользовать project issue query/filter pipeline, чтобы export возвращал тот же набор issue, что и текущий список.
- [x] 3.3 Реализовать lean export serializer/schema для табличного XLSX export без текущего тяжелого full-export payload.
- [x] 3.4 Реализовать workbook generation с metadata/filter summary block перед табличной частью.
- [x] 3.5 Добавить автогенерацию filename с расширением `.xlsx`.

## 4. Verification

- [x] 4.1 Написать frontend coverage на toolbar action, column normalization и download trigger flow.
- [x] 4.2 Написать backend tests на применение текущих фильтров в export queryset.
- [x] 4.3 Написать backend tests на структуру workbook: filter summary, обязательные колонки и layout-specific column rules.
- [x] 4.4 Протестировать вручную export из `list`, `kanban`, `spreadsheet`, `calendar` и `gantt_chart` на project issue page.
