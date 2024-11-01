document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const todoInput = document.getElementById('task-input'); 
    const todoList = document.getElementById('todo-list');
    const completedCountElem = document.getElementById('completed-count');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const logoutBtn = document.getElementById('logout-btn');
    const usernameElem = document.getElementById('username');
    const logoutContainer = document.getElementById('logout-container');

    let currentUser = null;
    let completedCount = 0;

    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            usernameElem.textContent = user.displayName || user.email;
            logoutContainer.style.display = 'block';
            loadTodos();
        } else {
            window.location.href = 'auth.html';
        }
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = 'auth.html';
        });
    });

    function loadTodos() {
        if (!currentUser) {
            console.error('No user is authenticated.');
            return;
        }
    
        db.collection('todos')
            .where('userId', '==', currentUser.uid)
            .orderBy('order', 'asc')
            .onSnapshot(
                (snapshot) => {
                    todoList.innerHTML = '';
                    completedCount = 0;
                    snapshot.forEach((doc) => {
                        const todo = doc.data();
                        todo.id = doc.id;
                        addTodoToUI(todo);
                        if (todo.is_completed) {
                            completedCount++;
                        }
                    });
                    updateCompletedCount();
                },
                (error) => {
                    console.error('Error fetching todos:', error);
                    alert('Error fetching todos: ' + error.message);
                }
            );
    }
    

    todoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && todoInput.value.trim() !== '') {
            addTodoToServer(todoInput.value.trim(), 'white'); 
            todoInput.value = '';
        }
    });

    function addTodoToServer(todoText, priority) {
        const nextOrder = Date.now();
        db.collection('todos').add({
            userId: currentUser.uid,
            todo: todoText,
            is_completed: false,
            priority: priority,
            order: nextOrder
        }).catch((error) => {
            alert('Error adding todo: ' + error.message);
        });
    }

    function addTodoToUI(todo) {
        console.log('Adding todo to UI:', todo); 
    
        const listItem = document.createElement('li');
        const moveIcon = document.createElement('span');
        const todoSpan = document.createElement('span');
        const priorityIndicator = document.createElement('span');
        const optionsBtn = document.createElement('button');
    
        listItem.className = 'todo-item';
        listItem.setAttribute('data-id', todo.id);
        listItem.setAttribute('data-order', todo.order);
        moveIcon.className = 'move-icon';
        todoSpan.className = 'todo-text';
        optionsBtn.className = 'options-button';
        priorityIndicator.className = 'priority-indicator';
    
        moveIcon.innerHTML = '&#9776;';
        todoSpan.textContent = todo.todo;
        optionsBtn.textContent = '\u22EE'; 
    
        priorityIndicator.style.backgroundColor = todo.priority || 'white';
    
        listItem.appendChild(moveIcon);
        listItem.appendChild(todoSpan);
        listItem.appendChild(priorityIndicator);
        listItem.appendChild(optionsBtn);
    
        listItem.setAttribute('draggable', !todo.is_completed);
    
        if (todo.is_completed) {
            listItem.classList.add('completed');
            moveIcon.style.display = 'none';
        }
    
        todoSpan.addEventListener('click', () => toggleComplete(listItem));
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showOptionsMenu(listItem, todoSpan, priorityIndicator, e.pageX, e.pageY);
        });
    
        if (!todo.is_completed) {
            addDragAndDrop(listItem);
        }
    
        insertTodoAtCorrectPosition(listItem);
    }
    
    

    function toggleComplete(listItem) {
        const todoId = listItem.getAttribute('data-id');
        const isCompleted = listItem.classList.toggle('completed');
        const moveIcon = listItem.querySelector('.move-icon');

        if (isCompleted) {
            listItem.removeAttribute('draggable');
            moveIcon.style.display = 'none';
            completedCount++;
            insertCompletedTodoAtCorrectPosition(listItem);
        } else {
            listItem.setAttribute('draggable', true);
            moveIcon.style.display = 'inline';
            completedCount--;
            insertTodoAtCorrectPosition(listItem);
        }
        updateCompletedCount();
        const todoText = listItem.querySelector('.todo-text').textContent;
        const priority = listItem.querySelector('.priority-indicator').style.backgroundColor;
        const order = parseInt(listItem.getAttribute('data-order')) || 0;
        updateTodoOnServer(todoId, todoText, isCompleted, priority, order);
    }

    function updateTodoOnServer(todoId, todoText, isCompleted, priority, order) {
        db.collection('todos').doc(todoId).update({
            todo: todoText,
            is_completed: isCompleted,
            priority: priority,
            order: order
        }).catch((error) => {
            alert('Error updating todo: ' + error.message);
        });
    }

    function deleteTodoFromServer(todoId) {
        db.collection('todos').doc(todoId).delete().catch((error) => {
            alert('Error deleting todo: ' + error.message);
        });
    }

    function showOptionsMenu(listItem, todoSpan, priorityIndicator, x, y) {
        const existingMenu = document.querySelector('.options-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.classList.add('options-menu');

        const priorityOptions = [
            { label: 'Set White', color: 'white' },
            { label: 'Set Orange', color: 'orange' },
            { label: 'Set Red', color: 'red' },
        ];

        priorityOptions.forEach((option) => {
            const priorityBtn = document.createElement('button');
            priorityBtn.textContent = option.label;
            priorityBtn.addEventListener('click', () => {
                priorityIndicator.style.backgroundColor = option.color;
                const todoId = listItem.getAttribute('data-id');
                const todoText = todoSpan.textContent;
                const isCompleted = listItem.classList.contains('completed');
                const order = parseInt(listItem.getAttribute('data-order')) || 0;
                updateTodoOnServer(todoId, todoText, isCompleted, option.color, order);
                menu.remove();
            });
            menu.appendChild(priorityBtn);
        });

        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit Todo';
        editBtn.addEventListener('click', () => {
            const newText = prompt('Edit todo:', todoSpan.textContent);
            if (newText !== null && newText.trim() !== '') {
                todoSpan.textContent = newText.trim();
                const todoId = listItem.getAttribute('data-id');
                const isCompleted = listItem.classList.contains('completed');
                const priority = priorityIndicator.style.backgroundColor;
                const order = parseInt(listItem.getAttribute('data-order')) || 0;
                updateTodoOnServer(todoId, newText.trim(), isCompleted, priority, order);
            }
            menu.remove();
        });
        menu.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete Todo';
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this todo?')) {
                const todoId = listItem.getAttribute('data-id');
                if (listItem.classList.contains('completed')) {
                    completedCount--;
                    updateCompletedCount();
                }
                listItem.remove();
                deleteTodoFromServer(todoId);
            }
            menu.remove();
        });
        menu.appendChild(deleteBtn);
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        document.body.appendChild(menu);

        document.addEventListener(
            'click',
            function onDocumentClick(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', onDocumentClick);
                }
            },
            { capture: true }
        );
    }

    function addDragAndDrop(listItem) {
        listItem.addEventListener('dragstart', () => {
            listItem.classList.add('dragging');
        });

        listItem.addEventListener('dragend', () => {
            listItem.classList.remove('dragging');
            updateAllTodoOrders();
        });

        todoList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = document.querySelector('.dragging');
            if (!draggingItem) return;
            const afterElement = getDragAfterElement(todoList, e.clientY);
            if (afterElement == null) {
                todoList.appendChild(draggingItem);
            } else {
                todoList.insertBefore(draggingItem, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [
            ...container.querySelectorAll('.todo-item:not(.dragging):not(.completed)'),
        ];

        return draggableElements.reduce(
            (closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            },
            { offset: Number.NEGATIVE_INFINITY }
        ).element;
    }

    function updateAllTodoOrders() {
        const todos = Array.from(todoList.querySelectorAll('.todo-item'));
        todos.forEach((todo, index) => {
            todo.setAttribute('data-order', index);
            const todoId = todo.getAttribute('data-id');
            const todoText = todo.querySelector('.todo-text').textContent;
            const priority = todo.querySelector('.priority-indicator').style.backgroundColor;
            const isCompleted = todo.classList.contains('completed');
            updateTodoOnServer(todoId, todoText, isCompleted, priority, index);
        });
    }

    clearCompletedBtn.addEventListener('click', () => {
        const completedTodos = todoList.querySelectorAll('.todo-item.completed');
        completedTodos.forEach((todo) => {
            const todoId = todo.getAttribute('data-id');
            todo.remove();
            deleteTodoFromServer(todoId);
        });
        completedCount = 0;
        updateCompletedCount();
    });

    function insertTodoAtCorrectPosition(listItem) {
        const todos = Array.from(todoList.querySelectorAll('.todo-item:not(.completed)'));
        const currentOrder = parseInt(listItem.getAttribute('data-order')) || 0;
        let inserted = false;
        for (let i = 0; i < todos.length; i++) {
            const todo = todos[i];
            const todoOrder = parseInt(todo.getAttribute('data-order')) || 0;
            if (currentOrder < todoOrder) {
                todoList.insertBefore(listItem, todo);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            todoList.appendChild(listItem);
        }
    }

    function insertCompletedTodoAtCorrectPosition(listItem) {
        todoList.appendChild(listItem);
    }

    function updateCompletedCount() {
        completedCountElem.textContent = completedCount;
    }
});
