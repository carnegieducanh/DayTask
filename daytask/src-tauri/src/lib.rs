mod tray;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_tasks_table",
            sql: "CREATE TABLE IF NOT EXISTS tasks (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT,
                category    TEXT CHECK(category IN ('work','personal','health','learn')),
                priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                reminder    TEXT,
                date        TEXT NOT NULL,
                is_done     INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_goals_table",
            sql: "CREATE TABLE IF NOT EXISTS goals (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                title       TEXT NOT NULL,
                description TEXT,
                category    TEXT CHECK(category IN ('work','personal','health','learn')),
                priority    TEXT CHECK(priority IN ('high','mid','low')) DEFAULT 'mid',
                year        INTEGER NOT NULL,
                quarter     TEXT CHECK(quarter IN ('Q1','Q2','Q3','Q4','full')),
                status      TEXT CHECK(status IN ('todo','doing','review','done')) DEFAULT 'todo',
                progress    INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
                position    INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_goal_checklist_items",
            sql: "CREATE TABLE IF NOT EXISTS goal_checklist_items (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_id  INTEGER NOT NULL,
                text     TEXT NOT NULL,
                is_done  INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_category_colors",
            sql: "CREATE TABLE IF NOT EXISTS category_colors (
                category TEXT PRIMARY KEY,
                color    TEXT NOT NULL
            );
            INSERT OR IGNORE INTO category_colors (category, color) VALUES
                ('work',     '#7DD3FC'),
                ('personal', '#86EFAC'),
                ('health',   '#FDBA74'),
                ('learn',    '#C4B5FD');",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:daytask.db", migrations)
                .build(),
        )
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
