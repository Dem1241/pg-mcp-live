# Live events

`pg-mcp-live` can listen for PostgreSQL notifications through the `wait_for_notification` tool.
You can inspect whether the optional pieces are installed with the `check_feature_support` tool.
You can also list table-by-table notification coverage with the `list_event_sources` tool.

The demo database includes an optional trigger script that emits a notification whenever a row changes in one of the demo tables.

## Install demo triggers

    docker exec -i pg-mcp-live-postgres psql -U pgmcp -d pg_mcp_live_demo < examples/live-events.sql

## Remove demo triggers

    docker exec -i pg-mcp-live-postgres psql -U pgmcp -d pg_mcp_live_demo < examples/remove-live-events.sql

## Notification channel

The default channel is:

    pg_mcp_live_events

## Example table change

    UPDATE inventory
    SET quantity = quantity - 1,
        updated_at = NOW()
    WHERE product_id = 1;

## Example notification payload

    {
      "event": "table_change",
      "operation": "UPDATE",
      "schema": "public",
      "table": "inventory",
      "changedAt": "2026-05-14T12:00:00.000Z",
      "oldRow": {
        "product_id": 1,
        "quantity": 25
      },
      "newRow": {
        "product_id": 1,
        "quantity": 24
      }
    }

## Notes

PostgreSQL notification payloads have a size limit. This demo trigger includes full row data because the demo rows are small.

A production setup should usually send compact event data, such as table name, primary key, operation, and timestamp.

## Persistent event history

For replayable event history, install the event log setup:

    docker exec -i pg-mcp-live-postgres psql -U pgmcp -d pg_mcp_live_demo < examples/event-log.sql

This creates:

    pg_mcp_live_event_log

The trigger will then both emit notifications and store events.

You can query stored events through the `get_recent_events` MCP tool.
If the event log has not been installed, the live-event history tools return a setup error that points back to `examples/event-log.sql`.
If you want to wait for the next matching event and immediately fetch its event-log rows, use `tail_recent_events`.

Example filters:

    tableName: inventory
    operation: UPDATE
    limit: 10

Remove the demo event setup with:

    docker exec -i pg-mcp-live-postgres psql -U pgmcp -d pg_mcp_live_demo < examples/remove-live-events.sql
