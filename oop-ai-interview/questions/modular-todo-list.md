# Modular Todo-List Application

## Question

Design a modular in-memory todo-list application that supports tasks, projects, filtering, and interchangeable storage.

## Clarifying Questions

* Are todos grouped into projects?
* Which fields and filters are required?
* Are due dates and priorities required?
* Is persistence required now?
* Do we need users or sharing?

Assume one user, optional project, title, priority, due date, completion, and in-memory storage.

## Components To Implement

~~~text
Todo, Project
Priority, TodoStatus
TodoRepository
InMemoryTodoRepository
ProjectRepository
InMemoryProjectRepository
TodoService
TodoFilter
Clock
~~~

## Relationships And Services

~~~text
Project stores project metadata; it does not hold a Todo collection.
Todo stores projectId and owns its status transitions.
TodoRepository stores and queries Todos.
ProjectRepository stores Projects and validates projectId references.
TodoService coordinates commands; it does not own a Todo map.
TodoFilter is an immutable query value, not a storage object.
~~~

## Main Operations

~~~text
createTodo(title, projectId, priority, dueAt)
completeTodo(todoId)
reopenTodo(todoId)
deleteTodo(todoId)
listTodos(filter)
~~~

## Invariants

~~~text
Todo and Project IDs are unique.
A Todo references an existing Project when projectId is present.
Only valid state transitions are allowed.
Only incomplete todos can be overdue.
Filtering does not mutate stored todos.
Repository concerns do not leak into the domain model.
~~~

## AI Prompt

~~~text
Implement a modular in-memory Java todo application using Todo, Project,
Priority, TodoStatus, TodoRepository, InMemoryTodoRepository,
ProjectRepository, InMemoryProjectRepository, TodoFilter, TodoService, and an
injected Clock.

Support create, complete, reopen, delete, and list with optional status, project,
priority, and overdue filters. Validate nonblank titles and project existence.
Keep Todo state changes inside domain methods and storage behind TodoRepository.

Project must not contain a Todo list. Todo references projectId. Store and query
Todos only through TodoRepository and Projects through ProjectRepository.
TodoService coordinates commands but must not
own a Todo Map. TodoFilter is an immutable query value passed to the repository.

Use plain Java with no REST API, UI, database, dependency-injection framework,
users, or notifications. Add JUnit tests for transitions, validation, combined
filters, overdue behavior, and repository substitution.
~~~

## Tests

~~~text
create todo with generated stable ID
reject blank title and unknown project
complete and reopen todo
reject invalid repeated transition
filter by project, status, and priority
overdue uses injected Clock and excludes completed todos
delete removes todo
service depends on repository interface, not implementation
~~~

## Tradeoffs And Follow-Ups

~~~text
Repository is useful because interchangeable storage is a requirement.
TodoFilter avoids one service method per filter combination.
Injected Clock makes overdue behavior deterministic.
Production can add a database repository, pagination, authorization, and events.
Do not add interfaces for domain objects with no interchangeable behavior.
~~~

## Strong Answer

> Modularity here means clear reasons to change: Todo owns its state, TodoService coordinates use cases, TodoRepository hides storage, and TodoFilter represents query choices. I demonstrate that boundary by testing the service against the in-memory repository and explaining how a database implementation replaces it.
