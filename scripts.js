// scripts.js

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Global Variables
let currentUser = null;
let currentUserRole = '';
let allowedClasses = [];
let canEdit = false;
let isSuperAdmin = false;
let attendanceData = [];
let allPersons = [];
let currentClass = '';
let editRecordId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
console.log("currentYear", currentYear);
console.log("currentMonth", currentMonth);


// Initialize Choices.js instances
let filterNameChoices;
let bulkRecordNamesChoices;
let recordNameChoices;
// let editRecordNameChoices;
let viewPersonChoices;

// DOM Elements
const signInModal = document.getElementById('signInModal');
const signUpModal = document.getElementById('signUpModal');
const mainContent = document.getElementById('mainContent');
const navbarMenu = document.getElementById('navbarMenu');
const hamburgerMenu = document.getElementById('hamburgerMenu');
const classSelect = document.getElementById('classSelect');
const nameSearchInput = document.getElementById('nameSearch');
const attendanceTableBody = document.getElementById('attendanceTable');
const calendarView = document.getElementById('calendarView');
const tableView = document.getElementById('tableView');
const calendar = document.getElementById('calendar');
const currentMonthYear = document.getElementById('currentMonthYear');
const prevMonthButton = document.getElementById('prevMonthButton');
const nextMonthButton = document.getElementById('nextMonthButton');
const addUserButton = document.getElementById('addUserButton');
const logoutButton = document.getElementById('logoutButton');

// Toast Notification Element
const toast = document.createElement('div');
toast.id = 'toast';
toast.className = 'hidden';
document.body.appendChild(toast);

// Authentication State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        initializeApp();
        hideSignInModal();
    } else {
        currentUser = null;
        resetApp();
        showSignInModal();
    }
});

// Show Sign-In Modal
function showSignInModal() {
    signInModal.classList.add('show');
    signInModal.classList.remove('hidden');
    mainContent.classList.add('hidden');
}

// Hide Sign-In Modal
function hideSignInModal() {
    signInModal.classList.remove('show');
    signInModal.classList.add('hidden');
    mainContent.classList.remove('hidden');
}

// Reset App
function resetApp() {
    currentUserRole = '';
    allowedClasses = [];
    canEdit = false;
    isSuperAdmin = false;
    attendanceData = [];
    allPersons = [];
    currentClass = '';
    editRecordId = null;
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();
    mainContent.classList.add('hidden');

    // Clear Choices.js instances
    destroyChoicesInstances();

    // Hide all modals
    closeForm('signUpModal');
    closeForm('addRecordForm');
    closeForm('addPersonForm');
    closeForm('bulkAttendanceForm');
    closeForm('editRecordForm');
    closeForm('viewPersonForm');

    // Clear attendance table and calendar
    attendanceTableBody.innerHTML = '';
    calendar.innerHTML = '';
}
// Destroy all Choices.js instances
function destroyChoicesInstances() {
    if (filterNameChoices) {
        filterNameChoices.destroy();
        filterNameChoices = null;
    }
    if (bulkRecordNamesChoices) {
        bulkRecordNamesChoices.destroy();
        bulkRecordNamesChoices = null;
    }
    if (recordNameChoices) {
        recordNameChoices.destroy();
        recordNameChoices = null;
    }
    if (viewPersonChoices) {
        viewPersonChoices.destroy();
        viewPersonChoices = null;
    }
}

// Handle Sign-In
document.getElementById('signInForm').addEventListener('submit', handleSignIn);

function handleSignIn(event) {
    event.preventDefault();
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;

    auth.signInWithEmailAndPassword(email, password)
        .then(userCredential => {
            currentUser = userCredential.user;
            initializeApp();
            hideSignInModal();
        })
        .catch(error => {
            showToast(error.message);
        });
}
// Load Persons for a Given Class and Choices.js Instance
function loadPersonsForForm(className, choicesInstance) {
    db.collection('classes').doc(className).collection('persons').get()
        .then(querySnapshot => {
            const persons = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                persons.push({
                    id: doc.id,
                    name: data.name,
                    unit: className
                });
            });
            const personOptions = persons.map(person => ({
                value: person.id,
                label: person.name.trim().toLowerCase() // Normalize the name
            }));


            choicesInstance.clearStore();
            choicesInstance.setChoices(personOptions, 'value', 'label', true);
        })
        .catch(error => {
            showToast('Error loading persons: ' + error.message);
        });
}

// Add Record Form
document.getElementById('recordClass').addEventListener('change', function () {
    const selectedClass = this.value;
    loadPersonsForForm(selectedClass, recordNameChoices);
});

// Bulk Attendance Form
document.getElementById('bulkRecordClass').addEventListener('change', function () {
    const selectedClass = this.value;
    loadPersonsForForm(selectedClass, bulkRecordNamesChoices);
});

// Edit Record Form
// document.getElementById('editRecordClass').addEventListener('change', function () {
//     const selectedClass = this.value;
//     loadPersonsForForm(selectedClass, editRecordNameChoices);
// });

// View/Edit Person Form
document.getElementById('viewPersonUnit').addEventListener('change', function () {
    const selectedClass = this.value;
    loadPersonsForForm(selectedClass, viewPersonChoices);
});
// Handle Sign-Up (SuperAdmin only)
document.getElementById('signUpForm').addEventListener('submit', handleSignUp);

function handleSignUp(event) {
    event.preventDefault();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;
    const role = document.getElementById('signUpRole').value;

    // Only SuperAdmin can create new users
    if (!isSuperAdmin) {
        showToast('You do not have permission to create users.');
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            // Save user role in Firestore
            return db.collection('users').doc(email).set({
                role: role
            });
        })
        .then(() => {
            showToast('User created successfully.');
            closeForm('signUpModal');
            document.getElementById('signUpForm').reset();
        })
        .catch(error => {
            showToast(error.message);
        });
}

// Logout User
logoutButton.addEventListener('click', logout);

function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        resetApp();
        showSignInModal();
    }).catch(error => {
        showToast('Error during logout: ' + error.message);
    });
}

// Initialize App after Authentication
function initializeApp() {
    getUserRole().then(role => {
        currentUserRole = role;
        setupPermissions(role);
        setupUIForRole();
        initializeChoices();
        loadAllPersons(); // Load all persons for the filter dropdown
        toggleView('calendar');
        setupEventListeners();
    }).catch(error => {
        showToast('Error initializing app: ' + error.message);
    });
}

// Get User Role from Firestore
function getUserRole() {
    return db.collection('users').doc(currentUser.email).get().then(doc => {
        if (doc.exists) {
            return doc.data().role;
        } else {
            // Default role if not set
            return 'Full Viewer';
        }
    });
}

// Setup Permissions based on Role
function setupPermissions(role) {
    allowedClasses = [];
    canEdit = false;
    isSuperAdmin = false;

    if (role === 'SuperAdmin') {
        isSuperAdmin = true;
        canEdit = true;
        // Fetch all classes dynamically
        db.collection('classes').get().then(snapshot => {
            snapshot.forEach(doc => {
                allowedClasses.push(doc.id);
            });
            populateClassSelect();
        }).catch(error => {
            showToast('Error fetching classes: ' + error.message);
        });
    } else if (role === 'Full Editor') {
        canEdit = true;
        // Fetch all classes dynamically
        db.collection('classes').get().then(snapshot => {
            snapshot.forEach(doc => {
                allowedClasses.push(doc.id);
            });
            populateClassSelect();
        }).catch(error => {
            showToast('Error fetching classes: ' + error.message);
        });
    } else if (role === 'Full Viewer') {
        canEdit = false;
        // Fetch all classes dynamically
        db.collection('classes').get().then(snapshot => {
            snapshot.forEach(doc => {
                allowedClasses.push(doc.id);
            });
            populateClassSelect();
        }).catch(error => {
            showToast('Error fetching classes: ' + error.message);
        });
    } else {
        // Class-specific roles
        const classMatch = role.match(/^(.*) (Viewer|Editor)$/);
        if (classMatch) {
            const className = classMatch[1];
            const roleType = classMatch[2];
            allowedClasses.push(className);
            canEdit = (roleType === 'Editor');
            populateClassSelect();
        } else {
            showToast('Unknown role. Logging out.');
            logout();
        }
    }
}

// Setup UI Elements based on Role
function setupUIForRole() {
    // Show or hide Create User button
    if (isSuperAdmin) {
        addUserButton.style.display = 'inline-block';
    } else {
        addUserButton.style.display = 'none';
    }
    // Show or hide editing controls
    if (!canEdit) {
        document.querySelectorAll('.control-button[data-action="addRecordForm"], .control-button[data-action="addPersonForm"], .control-button[data-action="bulkAttendanceForm"], .control-button[data-action="viewPersonForm"]').forEach(button => {
            button.style.display = 'none';
        });
    } else {
        document.querySelectorAll('.control-button[data-action="addRecordForm"], .control-button[data-action="addPersonForm"], .control-button[data-action="bulkAttendanceForm"], .control-button[data-action="viewPersonForm"]').forEach(button => {
            button.style.display = 'inline-block';
        });
    }

    // Set initial class
    if (allowedClasses.length > 0) {
        currentClass = allowedClasses[0];
        classSelect.value = currentClass;
        loadPersons();
        loadAttendance();
    } else {
        // showToast('No classes available.');
        
    }
}
// Initialize Choices.js
function initializeChoices() {
    // Initialize Choices.js for Filter Names if not already initialized
    if (!filterNameChoices) {
        filterNameChoices = new Choices('#filterName', {
            removeItemButton: true,
            searchResultLimit: 5,
            position: 'bottom',
            shouldSort: false,
            itemSelectText: '',
            searchFields: ['label', 'value'],
            fuseOptions: {
                include: 'score',
                threshold: 0.3 // Adjust threshold as needed
            }
        });
    }

    // Initialize Choices.js for Bulk Record Names if not already initialized
    if (!bulkRecordNamesChoices) {
        bulkRecordNamesChoices = new Choices('#bulkRecordNames', {
            removeItemButton: true,
            searchResultLimit: 5,
            position: 'bottom',
            shouldSort: false,
            itemSelectText: ''
        });
    }

    // Initialize Choices.js for Record Names if not already initialized
    if (!recordNameChoices) {
        recordNameChoices = new Choices('#recordName', {
            removeItemButton: true,
            maxItemCount: 1,
            searchResultLimit: 5,
            position: 'bottom',
            shouldSort: false,
            itemSelectText: '',
            searchEnabled: true,
            searchFields: ['label', 'value'],
            fuseOptions: {
                include: 'score',
                threshold: 0.3 // Adjust threshold as needed
            }
        });
    }

    // Initialize Choices.js for Edit Record Names if not already initialized
    // if (!editRecordNameChoices) {
    //     editRecordNameChoices = new Choices('#editRecordName', {
    //         searchResultLimit: 5,
    //         position: 'bottom',
    //         shouldSort: false,
    //         itemSelectText: ''
    //     });
    // }
    // Initialize Choices.js for View Person Select if not already initialized
    if (!viewPersonChoices) {
        viewPersonChoices = new Choices('#viewPersonSelect', {
            removeItemButton: true,
            maxItemCount: 1,
            searchResultLimit: 5,
            position: 'bottom',
            shouldSort: false,
            itemSelectText: '',
        });
    }
}
function closeModal(event) {
    if (event.target === event.currentTarget) {
        event.currentTarget.classList.add('hidden');
    }
}


// Populate Class Select Dropdown
function populateClassSelect() {
    classSelect.innerHTML = '';
    // Add "All Classes" option
    const allOption = document.createElement('option');
    allOption.value = 'All Classes';
    allOption.textContent = 'All Classes';
    classSelect.appendChild(allOption);

    allowedClasses.forEach(cls => {
        const option = document.createElement('option');
        option.value = cls;
        option.textContent = cls;
        classSelect.appendChild(option);
    });

    // Set "All Classes" as default
    currentClass = 'All Classes';
    classSelect.value = currentClass;
    loadPersons();
    loadAttendance();
}
// Load Persons from Firestore based on currentClass
function loadPersons() {
    allPersons = [];
    let classesToLoad = [];

    if (currentClass === 'All Classes') {
        classesToLoad = allowedClasses;
    } else {
        classesToLoad = [currentClass];
    }

    let promises = classesToLoad.map(cls => {
        return db.collection('classes').doc(cls).collection('persons').get()
            .then(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    allPersons.push({
                        id: doc.id,
                        name: data.name,
                        unit: cls
                    });
                });
            });
    });

    Promise.all(promises).then(() => {
        populatePersonSelects();
    }).catch(error => {
        showToast('Error loading persons: ' + error.message);
    });
}
// Populate Person Select Dropdowns
function populatePersonSelects() {
    const personOptions = allPersons.map(person => ({
        value: person.id,
        label: `${person.name} (${person.unit})` // Include unit for clarity
    }));

    // Update Filter Name Choices
    if (filterNameChoices) {
        filterNameChoices.clearStore();
        filterNameChoices.setChoices(personOptions, 'value', 'label', true);
    }

    // Populate Bulk Record Names Choices (Filter based on selected class)
    if (bulkRecordNamesChoices) {
        const bulkPersonOptions = currentClass === 'All Classes' ? personOptions : personOptions.filter(p => p.unit === currentClass);
        bulkRecordNamesChoices.clearStore();
        bulkRecordNamesChoices.setChoices(bulkPersonOptions, 'value', 'label', true);
    }

    // Populate Record Name Choices (Filter based on selected class)
    if (recordNameChoices) {
        const recordPersonOptions = currentClass === 'All Classes' ? personOptions : personOptions.filter(p => p.unit === currentClass);
        recordNameChoices.clearStore();
        recordNameChoices.setChoices(recordPersonOptions, 'value', 'label', true);
    }


    // Populate Edit Record Name Choices
    // if (editRecordNameChoices) {
    //     editRecordNameChoices.clearStore();
    //     editRecordNameChoices.setChoices(personOptions, 'value', 'label', true);
    // }

    // Populate View Person Choices
    if (viewPersonChoices) {
        viewPersonChoices.clearStore();
        viewPersonChoices.setChoices(personOptions, 'value', 'label', true);
    }
}

// Load Attendance Data from Firestore based on currentClass
function loadAttendance() {
    attendanceData = [];
    let classesToLoad = [];

    if (currentClass === 'All Classes') {
        classesToLoad = allowedClasses;
    } else {
        classesToLoad = [currentClass];
    }

    let promises = classesToLoad.map(cls => {
        return db.collection('classes').doc(cls).collection('attendance').get()
            .then(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const dateObj = data.date.toDate();
                    const year = dateObj.getFullYear();
                    const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
                    const day = ('0' + dateObj.getDate()).slice(-2);
                    const dateStr = `${year}-${month}-${day}`;
                    attendanceData.push({
                        id: doc.id,
                        class: cls,
                        personId: data.personId,
                        name: data.name,
                        date: dateStr,
                        attendance: data.attendance,
                        description: data.description || ''
                    });
                });
            });
    });

    Promise.all(promises)
        .then(() => {
            // applyFilters();
            generateCalendarView();
        })
        .catch(error => {
            showToast('Error loading attendance data: ' + error.message);
        });
}
// Setup Event Listeners
function setupEventListeners() {
    // Control Buttons
    document.querySelectorAll('.control-button').forEach(button => {
        button.addEventListener('click', function () {
            const action = this.getAttribute('data-action');
            if (action) {
                handleControlAction(action);
            }
        });
    });

    // Hamburger Menu
    hamburgerMenu.addEventListener('click', toggleHamburgerMenu);

    // Class Selection Change
    if (classSelect) {
        classSelect.addEventListener('change', function () {
            currentClass = this.value;
            loadPersons();
            loadAttendance();
        });
    }

    // Search Input
    nameSearchInput.addEventListener('input', applyFilters);

    // Close Modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeForm(modal.id);
            }
        });
    });

    // Previous and Next Month Buttons
    document.addEventListener('DOMContentLoaded', function () {
        // Make sure event listeners are attached only once
        if (!prevMonthButton.getAttribute('data-listener-attached')) {
            prevMonthButton.addEventListener('click', () => changeMonth(-1));
            prevMonthButton.setAttribute('data-listener-attached', true);
        }

        if (!nextMonthButton.getAttribute('data-listener-attached')) {
            nextMonthButton.addEventListener('click', () => changeMonth(1));
            nextMonthButton.setAttribute('data-listener-attached', true);
        }
    });

    // Add Record Form Submit
    document.getElementById('addRecordForm').addEventListener('submit', function (e) {
        e.preventDefault();
        addRecord();
    });

    // Add Person Form Submit
    document.getElementById('addPersonForm').addEventListener('submit', function (e) {
        e.preventDefault();
        addPerson();
    });

    // Bulk Attendance Form Submit
    document.getElementById('bulkAttendanceForm').addEventListener('submit', function (e) {
        e.preventDefault();
        addBulkAttendance();
    });

    // Edit Record Form Submit
    document.getElementById('editRecordForm').addEventListener('submit', function (e) {
        e.preventDefault();
        updateRecord();
    });

    // View Person Select Change
    document.getElementById('viewPersonSelect').addEventListener('change', loadPersonData);

    // Toggle Filter Dropdown
}


// Handle Control Actions
function handleControlAction(action) {
    switch (action) {
        case 'addRecordForm':
            openForm('addRecordForm');
            break;
        case 'addPersonForm':
            openForm('addPersonForm');
            break;
        case 'bulkAttendanceForm':
            openForm('bulkAttendanceForm');
            break;
        case 'calendar':
            toggleView('calendar');
            break;
        case 'table':
            toggleView('table');
            break;
        case 'downloadMonthlyData':
            downloadMonthlyData();
            break;
        case 'statistics':
            showToast('Statistics feature is under development.');
            break;
        case 'viewPersonForm':
            openForm('viewPersonForm');
            break;
        default:
            showToast('Unknown action.');
            break;
    }
}

// Toggle Hamburger Menu
function toggleHamburgerMenu() {
    navbarMenu.classList.toggle('show');
}
// Open Form Modal
function openForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.classList.remove('hidden');
        form.classList.add('show');
        // Trigger loading persons for default selected class
        if (formId === 'addRecordForm') {
            const selectedClass = document.getElementById('recordClass').value;
            loadPersonsForForm(selectedClass, recordNameChoices);
        } else if (formId === 'bulkAttendanceForm') {
            const selectedClass = document.getElementById('bulkRecordClass').value;
            loadPersonsForForm(selectedClass, bulkRecordNamesChoices);
        } else if (formId === 'viewPersonForm') {
            const selectedClass = document.getElementById('viewPersonUnit').value;
            loadPersonsForForm(selectedClass, viewPersonChoices);
        }
    } else {
        showToast(`Form with ID '${formId}' not found.`);
    }
}


// Close Form Modal
function closeForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        // Reset the form fields
        const formElement = form.querySelector('form');
        if (formElement) {
            formElement.reset();
        }
        // Reset any Choices.js instances related to this form
        if (formId === 'addRecordForm') {
            recordNameChoices.removeActiveItems();
            const selectedClass = document.getElementById('recordClass').value;
            loadPersonsForForm(selectedClass, recordNameChoices);
            toggleDescription(); // Hide description fields if visible
        } else if (formId === 'addPersonForm') {
            // No Choices.js instances in addPersonForm
        } else if (formId === 'bulkAttendanceForm') {
            bulkRecordNamesChoices.removeActiveItems();
            const selectedClass = document.getElementById('bulkRecordClass').value;
            loadPersonsForForm(selectedClass, bulkRecordNamesChoices);
        } else if (formId === 'viewPersonForm') {
            viewPersonChoices.removeActiveItems();
            const selectedClass = document.getElementById('viewPersonUnit').value;
            loadPersonsForForm(selectedClass, viewPersonChoices);
            document.getElementById('personData').classList.add('hidden');
            clearModalError('viewPerson'); // Clear any previous errors
        } else if (formId === 'editRecordForm') {
            // No Choices.js instances to reset in editRecordForm
            clearModalError('editRecord'); // Clear any previous errors
        } else if (formId === 'signUpModal') {
            // Reset sign-up form fields
            document.getElementById('signUpForm').reset();
        }
        // Hide the modal
        form.classList.add('hidden');
        form.classList.remove('show');
    } else {
        showToast(`Form with ID '${formId}' not found.`);
    }
}


// Toggle View between Calendar and Table
function toggleView(view) {
    if (view === 'calendar') {
        calendarView.classList.remove('hidden');
        tableView.classList.add('hidden');
        generateCalendarView();
    } else if (view === 'table') {
        calendarView.classList.add('hidden');
        tableView.classList.remove('hidden');
        populateAttendanceTable();
    }
}
// Apply Filters
function applyFilters() {
    let filteredData = [...attendanceData];

    // Filter by Name Search
    const nameSearchValue = nameSearchInput.value.toLowerCase();
    if (nameSearchValue) {
        filteredData = filteredData.filter(entry =>
            entry.name.toLowerCase().includes(nameSearchValue)
        );
    }

    // Filter by Selected Names
    const selectedNames = filterNameChoices.getValue(true);
    if (selectedNames.length > 0) {
        filteredData = filteredData.filter(entry =>
            selectedNames.includes(entry.personId)
        );
    }

    // Filter by Date
    const filterDate = document.getElementById('filterDate').value;
    if (filterDate) {
        filteredData = filteredData.filter(entry => entry.date === filterDate);
    }

    // Update Views
    populateAttendanceTable(filteredData);
    generateCalendarView(filteredData);

    // Close the filter modal
    toggleFilterDropdown();
}


// Populate Attendance Table
// Populate Attendance Table
function populateAttendanceTable(data = attendanceData) {
    attendanceTableBody.innerHTML = '';
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align:center;">No records found.</td>`;
        attendanceTableBody.appendChild(row);
        return;
    }

    if (currentClass === 'All Classes') {
        // Group data by date and class
        const groupedData = {};
        data.forEach(entry => {
            if (!groupedData[entry.date]) {
                groupedData[entry.date] = {};
            }
            if (!groupedData[entry.date][entry.class]) {
                groupedData[entry.date][entry.class] = [];
            }
            groupedData[entry.date][entry.class].push(entry);
        });

        for (const date in groupedData) {
            for (const cls in groupedData[date]) {
                // Add a heading for each class
                const classRow = document.createElement('tr');
                classRow.innerHTML = `<td colspan="6" style="background-color: #f0f0f0;"><strong>${date} - ${cls}</strong></td>`;
                attendanceTableBody.appendChild(classRow);

                groupedData[date][cls].forEach(entry => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${entry.class}</td>
                        <td>${entry.name}</td>
                        <td>${entry.date}</td>
                        <td>${entry.attendance}</td>
                        <td>${entry.description}</td>
                        <td>
                            ${canEdit ? `<button class="edit-button" onclick="openEditRecordForm('${entry.id}', '${entry.class}')">Edit</button>` : ''}
                        </td>
                    `;
                    attendanceTableBody.appendChild(row);
                });
            }
        }
    } else {
        // Original view for single class
        data.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${currentClass}</td>
                <td>${entry.name}</td>
                <td>${entry.date}</td>
                <td>${entry.attendance}</td>
                <td>${entry.description}</td>
                <td>
                    ${canEdit ? `<button class="edit-button" onclick="openEditRecordForm('${entry.id}', '${currentClass}')">Edit</button>` : ''}
                </td>
            `;
            attendanceTableBody.appendChild(row);
        });
    }
}

// Open Edit Record Form
// Open Edit Record Form
function openEditRecordForm(id, cls) {
    if (!canEdit) {
        showToast('You do not have permission to edit records.');
        return;
    }
    editRecordId = id;
    const record = attendanceData.find(entry => entry.id === id && entry.class === cls);
    if (record) {
        // Set the class name and name as read-only inputs
        document.getElementById('editRecordClass').value = record.class;
        document.getElementById('editRecordName').value = record.name;
        document.getElementById('editRecordDate').value = record.date;
        document.getElementById('editRecordAttendance').value = record.attendance;
        document.getElementById('editRecordDescription').value = record.description || '';
        toggleEditDescription(); // Show/hide description based on attendance
        openForm('editRecordForm'); // Open the edit modal
    } else {
        showToast('Record not found.');
    }
}

// Update Record
// Update Record
function updateRecord() {
    if (!canEdit) {
        showToast('You do not have permission to update records.');
        return;
    }
    const selectedRecordId = editRecordId;
    const className = document.getElementById('editRecordClass').value;

    if (!selectedRecordId) {
        showModalError('editRecord', 'No record selected for editing.');
        return;
    }

    const dateInput = document.getElementById('editRecordDate').value;
    const dateParts = dateInput.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0);
    const attendance = document.getElementById('editRecordAttendance').value;
    const description = document.getElementById('editRecordDescription').value.trim();

    const updatedRecord = {
        date: firebase.firestore.Timestamp.fromDate(date),
        attendance: attendance,
        description: description
    };

    db.collection('classes').doc(className).collection('attendance').doc(selectedRecordId).update(updatedRecord)
        .then(() => {
            showToast('Record updated successfully.');
            closeForm('editRecordForm');
            editRecordId = null;
            clearModalError('editRecord'); // Clear any previous errors
        })
        .catch(error => {
            showModalError('editRecord', 'Error updating record: ' + error.message);
        });
}

// Generate Calendar View
function generateCalendarView(data = attendanceData) {
    calendar.innerHTML = '';
    currentMonthYear.textContent = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentYear, currentMonth, day);
        const year = dateObj.getFullYear();
        const month = ('0' + (dateObj.getMonth() + 1)).slice(-2);
        const dayStr = ('0' + dateObj.getDate()).slice(-2);
        const dateStr = `${year}-${month}-${dayStr}`;
        const dayData = data.filter(entry => entry.date === dateStr);

        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');

        dayDiv.innerHTML = `
            <span class="day-name">${dateObj.toLocaleString('default', { weekday: 'short' })}</span>
            <span class="day-number">${day}</span>
        `;

        if (dayData.length > 0) {
            if (currentClass === 'All Classes') {
                // Group by class
                const classGroups = {};
                dayData.forEach(entry => {
                    if (!classGroups[entry.class]) {
                        classGroups[entry.class] = [];
                    }
                    classGroups[entry.class].push(entry.name);
                });

                for (const cls in classGroups) {
                    const classHeading = document.createElement('div');
                    classHeading.innerHTML = `<strong>${cls}</strong>`;
                    dayDiv.appendChild(classHeading);

                    const namesDiv = document.createElement('div');
                    namesDiv.classList.add('names');
                    namesDiv.innerHTML = classGroups[cls].map(name => `<span title="${name}">${name}</span>`).join('<br>');
                    dayDiv.appendChild(namesDiv);
                }
            } else {
                // Original view for single class
                const namesDiv = document.createElement('div');
                namesDiv.classList.add('names');
                namesDiv.innerHTML = dayData.map(entry => `<span title="${entry.name}">${entry.name}</span>`).join('<br>');
                dayDiv.appendChild(namesDiv);
            }

            dayDiv.classList.add('attended');

            // Add the download button
            const downloadButton = document.createElement('button');
            downloadButton.classList.add('download-button');
            downloadButton.textContent = 'Download';
            downloadButton.addEventListener('click', () => downloadDailyAttendance(dateStr));
            dayDiv.appendChild(downloadButton);
        } else {
            dayDiv.classList.add('not-attended');
        }

        calendar.appendChild(dayDiv);
    }

    updateMonthButtons();
}




// Update Month Navigation Buttons
function updateMonthButtons() {
    const prevMonthDate = new Date(currentYear, currentMonth - 1);
    const nextMonthDate = new Date(currentYear, currentMonth + 1);

    prevMonthButton.innerHTML = `&#10094; ${prevMonthDate.toLocaleString('default', { month: 'long' })}`;
    nextMonthButton.innerHTML = `${nextMonthDate.toLocaleString('default', { month: 'long' })} &#10095;`;
}
// Change Month
function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    generateCalendarView();
}
// Add Record
function addRecord() {
    if (!canEdit) {
        showToast('You do not have permission to add records.');
        return;
    }

    const className = document.getElementById('recordClass').value;
    const nameIds = recordNameChoices.getValue(true);
    const personId = nameIds.length > 0 ? nameIds[0] : null;

    if (!personId) {
        showToast('Please select a person.');
        return;
    }

    const person = allPersons.find(p => p.id === personId);
    if (!person) {
        showToast('Selected person not found.');
        return;
    }

    const dateInput = document.getElementById('recordDate').value;
    const dateParts = dateInput.split('-');
    const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        12,
        0,
        0
    );
    const attendance = document.getElementById('recordAttendance').value;
    const description = document.getElementById('recordDescription').value.trim();

    if (!className) {
        showToast('Please select a class.');
        return;
    }

    const attendanceRef = db.collection('classes').doc(className).collection('attendance');

    // Check for duplicate record
    attendanceRef
        .where('personId', '==', personId)
        .where('date', '==', firebase.firestore.Timestamp.fromDate(date))
        .get()
        .then(querySnapshot => {
            if (!querySnapshot.empty) {
                showToast('A record for this person on this date already exists.');
                return;
            }

            const newRecord = {
                name: person.name,
                personId: person.id,
                date: firebase.firestore.Timestamp.fromDate(date),
                attendance: attendance,
                description: description
            };

            attendanceRef
                .add(newRecord)
                .then(() => {
                    showToast('Records added successfully.');
                    closeForm('addRecordForm');
                    document.getElementById('addRecordForm').reset();
                    toggleDescription(); // Hide description if needed
                })
                .catch(error => {
                    showToast('Error adding record: ' + error.message);
                });
        })
        .catch(error => {
            showToast('Error checking for duplicate record: ' + error.message);
        });
}
// Display error message inside a specific modal
function showModalError(modalId, message) {
    const errorElement = document.getElementById(`${modalId}Error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Clear error message inside a specific modal
function clearModalError(modalId) {
    const errorElement = document.getElementById(`${modalId}Error`);
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}



// Add Person
async function addPerson() {
    if (!canEdit) {
        showToast('You do not have permission to add persons.');
        return;
    }

    // Collect form data
    const unit = document.getElementById('personUnit').value;
    const name = document.getElementById('personName').value.trim();
    const address = document.getElementById('personAddress').value.trim();
    const dob = document.getElementById('personDOB').value;
    const mobile = document.getElementById('personMobile').value.trim();
    const phone = document.getElementById('personPhone').value.trim();
    const email = document.getElementById('personEmail').value.trim();
    const school = document.getElementById('personSchool').value.trim();
    const academicYear = document.getElementById('personAcademicYear').value.trim();
    const family = document.getElementById('personFamily').value.trim();
    const servant = document.getElementById('personServant').value.trim();
    const affiliation = document.getElementById('personAffiliation').value.trim();
    const church = document.getElementById('personChurch').value.trim();
    const folar = document.getElementById('personFolar').value;

    if (!unit || !name || !address || !dob || !mobile || !phone || !email || !school || !academicYear || !family || !servant || !affiliation || !church || !folar) {
        showToast('Please fill in all required fields.');
        return;
    }

    const personsRef = db.collection('classes').doc(unit).collection('persons');

    try {
        // Check for duplicate mobile
        let querySnapshot = await personsRef.where('mobile', '==', mobile).get();
        if (!querySnapshot.empty) {
            showToast('A person with this mobile number already exists.');
            return;
        }

        // Check for duplicate email
        querySnapshot = await personsRef.where('email', '==', email).get();
        if (!querySnapshot.empty) {
            showToast('A person with this email already exists.');
            return;
        }

        const newPerson = {
            name: name,
            address: address,
            dob: dob,
            mobile: mobile,
            phone: phone,
            email: email,
            school: school,
            academicYear: academicYear,
            family: family,
            servant: servant,
            affiliation: affiliation,
            church: church,
            folar: folar
        };

        await personsRef.add(newPerson);
        showToast('Person added successfully.');
        closeForm('addPersonForm');
        document.getElementById('personUnit').value = '';
        document.getElementById('personName').value = '';
        document.getElementById('personAddress').value = '';
        document.getElementById('personDOB').value = '';
        document.getElementById('personMobile').value = '';
        document.getElementById('personPhone').value = '';
        document.getElementById('personEmail').value = '';
        document.getElementById('personSchool').value = '';
        document.getElementById('personAcademicYear').value = '';
        document.getElementById('personFamily').value = '';
        document.getElementById('personServant').value = '';
        document.getElementById('personAffiliation').value = '';
        document.getElementById('personChurch').value = '';
        document.getElementById('personFolar').value = '';


    } catch (error) {
        showToast('Error adding person: ' + error.message);
    }
}
// Add Bulk Attendance
function addBulkAttendance() {
    if (!canEdit) {
        showToast('You do not have permission to add attendance.');
        return;
    }

    const className = document.getElementById('bulkRecordClass').value;
    const selectedNames = bulkRecordNamesChoices.getValue(true);
    const dateInput = document.getElementById('bulkRecordDate').value;
    const dateParts = dateInput.split('-');
    const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
        12,
        0,
        0
    );
    const attendance = document.getElementById('bulkRecordAttendance').value;

    if (!className || selectedNames.length === 0 || !dateInput || !attendance) {
        showToast('Please fill in all required fields.');
        return;
    }

    const attendanceRef = db.collection('classes').doc(className).collection('attendance');
    const dateTimestamp = firebase.firestore.Timestamp.fromDate(date);

    let duplicatePersons = [];
    let batch = db.batch();

    // First, check for duplicates
    let checkPromises = selectedNames.map(personId => {
        return attendanceRef
            .where('personId', '==', personId)
            .where('date', '==', dateTimestamp)
            .get()
            .then(querySnapshot => {
                if (!querySnapshot.empty) {
                    const person = allPersons.find(p => p.id === personId);
                    duplicatePersons.push(person.name);
                    return null; // Skip adding this person
                } else {
                    const person = allPersons.find(p => p.id === personId);
                    if (person) {
                        const attendanceDocRef = attendanceRef.doc();
                        const newRecord = {
                            name: person.name,
                            personId: person.id,
                            date: dateTimestamp,
                            attendance: attendance,
                            description: ''
                        };
                        batch.set(attendanceDocRef, newRecord);
                    }
                }
            });
    });

    Promise.all(checkPromises)
        .then(() => {
            if (duplicatePersons.length > 0) {
                showToast(
                    `Records already exist for: ${duplicatePersons.join(', ')}. They were not added again.`
                );
            }

            if (batch._writeBatch._mutations.length === 0) {
                showToast('No new records were added.');
                return;
            }

            batch
                .commit()
                .then(() => {
                    showToast('Bulk attendance added successfully.');
                    closeForm('bulkAttendanceForm');
                    document.getElementById('bulkAttendanceForm').reset();
                })
                .catch(error => {
                    showToast('Error adding bulk attendance: ' + error.message);
                });
        })
        .catch(error => {
            showToast('Error checking for duplicate records: ' + error.message);
        });
}
// Populate Attendance Table with Filtered Data
function populateAttendanceTable(data = attendanceData) {
    attendanceTableBody.innerHTML = '';
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" style="text-align:center;">No records found.</td>`;
        attendanceTableBody.appendChild(row);
        return;
    }
    data.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${currentClass}</td>
            <td>${entry.name}</td>
            <td>${entry.date}</td>
            <td>${entry.attendance}</td>
            <td>${entry.description}</td>
            <td>
                ${canEdit ? `<button class="edit-button" onclick="openEditRecordForm('${entry.id}', '${currentClass}')">Edit</button>` : ''}
            </td>
        `;
        attendanceTableBody.appendChild(row);
    });
}

// Download Monthly Data as Excel
function downloadMonthlyData() {
    const filteredData = attendanceData.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    });

    if (filteredData.length === 0) {
        showToast('No attendance data available for this month.');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");
    XLSX.writeFile(workbook, `Attendance_${currentMonth + 1}_${currentYear}.xlsx`);
    showToast('Monthly attendance data downloaded successfully.');
}

// Download Daily Attendance as Excel
function downloadDailyAttendance(dateStr) {
    const filteredData = attendanceData.filter(entry => entry.date === dateStr);

    if (filteredData.length === 0) {
        showToast('No attendance data available for this day.');
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Attendance");
    XLSX.writeFile(workbook, `Attendance_${dateStr}.xlsx`);
    showToast(`Attendance data for ${dateStr} downloaded successfully.`);
}

// Toggle Description Input based on Attendance Status in Add Record Form
function toggleDescription() {
    const attendance = document.getElementById('recordAttendance').value;
    const descriptionLabel = document.getElementById('descriptionLabel');
    const descriptionInput = document.getElementById('recordDescription');

    if (attendance !== 'Attended') {
        descriptionLabel.classList.remove('hidden');
        descriptionInput.classList.remove('hidden');
    } else {
        descriptionLabel.classList.add('hidden');
        descriptionInput.classList.add('hidden');
    }
}

// Toggle Description Input based on Attendance Status in Edit Record Form
function toggleEditDescription() {
    const attendance = document.getElementById('editRecordAttendance').value;
    const descriptionLabel = document.getElementById('editDescriptionLabel');
    const descriptionInput = document.getElementById('editRecordDescription');

    if (attendance !== 'Attended') {
        descriptionLabel.classList.remove('hidden');
        descriptionInput.classList.remove('hidden');
    } else {
        descriptionLabel.classList.add('hidden');
        descriptionInput.classList.add('hidden');
    }
}

// Show Toast Notification
function showToast(message) {
    toast.textContent = message;
    toast.className = 'show';
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}

// Toggle Filter Dropdown Visibility
function toggleFilterDropdown() {
    const filterDropdownContent = document.getElementById('filterDropdownContent');
    if (filterDropdownContent.classList.contains('show')) {
        filterDropdownContent.classList.remove('show');
        filterDropdownContent.classList.add('hidden');
    } else {
        filterDropdownContent.classList.remove('hidden');
        filterDropdownContent.classList.add('show');
    }
}



// Load Person Data for View/Edit
// Load Person Data for View/Edit
function loadPersonData() {
    const personIds = viewPersonChoices.getValue(true); // Returns an array
    const personId = personIds.length > 0 ? personIds[0] : null;
    const selectedClass = document.getElementById('viewPersonUnit').value; // Get selected class

    if (!selectedClass) {
        showModalError('viewPerson', 'Please select a class.');
        return;
    }

    if (!personId) {
        showModalError('viewPerson', 'Please select a person.');
        return;
    }

    clearModalError('viewPerson'); // Clear previous errors

    db.collection('classes').doc(selectedClass).collection('persons').doc(personId).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('viewPersonAddress').value = data.address || '';
                document.getElementById('viewPersonDOB').value = data.dob || '';
                document.getElementById('viewPersonMobile').value = data.mobile || '';
                document.getElementById('viewPersonPhone').value = data.phone || '';
                document.getElementById('viewPersonEmail').value = data.email || '';
                document.getElementById('viewPersonSchool').value = data.school || '';
                document.getElementById('viewPersonAcademicYear').value = data.academicYear || '';
                document.getElementById('viewPersonFamily').value = data.family || '';
                document.getElementById('viewPersonServant').value = data.servant || '';
                document.getElementById('viewPersonAffiliation').value = data.affiliation || '';
                document.getElementById('viewPersonChurch').value = data.church || '';
                document.getElementById('viewPersonFolar').value = data.folar || '';
                document.getElementById('personData').classList.remove('hidden');
            } else {
                showModalError('viewPerson', 'Person not found.');
            }
        })
        .catch(error => {
            showModalError('viewPerson', 'Error loading person data: ' + error.message);
        });
}



function loadAllPersons() {
    allPersons = [];
    const classesToLoad = allowedClasses;
    let promises = classesToLoad.map(cls => {
        return db.collection('classes').doc(cls).collection('persons').get()
            .then(querySnapshot => {
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    allPersons.push({
                        id: doc.id,
                        name: data.name,
                        unit: cls
                    });
                });
            });
    });

    Promise.all(promises).then(() => {
        populateFilterNameChoices();
    }).catch(error => {
        showToast('Error loading persons: ' + error.message);
    });
}

function populateFilterNameChoices() {
    // Ensure names are fully displayed
    const personOptions = allPersons.map(person => ({
        value: person.id,
        label: `${person.name} (${person.unit})` // Include unit for clarity
    }));

    if (filterNameChoices) {
        filterNameChoices.clearStore();
        filterNameChoices.setChoices(personOptions, 'value', 'label', true);
    }
}
// Edit Person Data
// Edit Person Data
async function editPersonData() {
    if (!canEdit) {
        showModalError('viewPerson', 'You do not have permission to edit persons.');
        return;
    }

    const personIds = viewPersonChoices.getValue(true);
    const personId = personIds.length > 0 ? personIds[0] : null;
    const selectedClass = document.getElementById('viewPersonUnit').value; // Get selected class

    if (!selectedClass) {
        showModalError('viewPerson', 'Please select a class.');
        return;
    }

    if (!personId) {
        showModalError('viewPerson', 'Please select a person.');
        return;
    }

    // Collect form data
    const address = document.getElementById('viewPersonAddress').value.trim();
    const dob = document.getElementById('viewPersonDOB').value;
    const mobile = document.getElementById('viewPersonMobile').value.trim();
    const phone = document.getElementById('viewPersonPhone').value.trim();
    const email = document.getElementById('viewPersonEmail').value.trim();
    const school = document.getElementById('viewPersonSchool').value.trim();
    const academicYear = document.getElementById('viewPersonAcademicYear').value.trim();
    const family = document.getElementById('viewPersonFamily').value.trim();
    const servant = document.getElementById('viewPersonServant').value.trim();
    const affiliation = document.getElementById('viewPersonAffiliation').value.trim();
    const church = document.getElementById('viewPersonChurch').value.trim();
    const folar = document.getElementById('viewPersonFolar').value;

    if (!address || !dob || !mobile || !phone || !email || !school || !academicYear || !family || !servant || !affiliation || !church || !folar) {
        showModalError('viewPerson', 'Please fill in all required fields.');
        return;
    }

    const personsRef = db.collection('classes').doc(selectedClass).collection('persons');

    try {
        // Check for duplicate mobile
        let querySnapshot = await personsRef.where('mobile', '==', mobile).where(firebase.firestore.FieldPath.documentId(), '!=', personId).get();
        if (!querySnapshot.empty) {
            showModalError('viewPerson', 'A person with this mobile number already exists.');
            return;
        }

        // Check for duplicate email
        querySnapshot = await personsRef.where('email', '==', email).where(firebase.firestore.FieldPath.documentId(), '!=', personId).get();
        if (!querySnapshot.empty) {
            showModalError('viewPerson', 'A person with this email already exists.');
            return;
        }

        const updatedPerson = {
            address: address,
            dob: dob,
            mobile: mobile,
            phone: phone,
            email: email,
            school: school,
            academicYear: academicYear,
            family: family,
            servant: servant,
            affiliation: affiliation,
            church: church,
            folar: folar
        };

        await personsRef.doc(personId).update(updatedPerson);
        showToast('Person data updated successfully.');
        closeForm('viewPersonForm');
        document.getElementById('viewPersonForm').reset();
        document.getElementById('personData').classList.add('hidden');
        clearModalError('viewPerson'); // Clear any previous errors
    } catch (error) {
        showModalError('viewPerson', 'Error updating person data: ' + error.message);
    }
}



// Download Attendance Data as Excel
function downloadAttendanceData(data, filename) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, filename);
}

// Ensure all Choices.js dropdowns are updated when class changes
classSelect.addEventListener('change', () => {
    initializeChoices();
});

// Wrap initialization code in DOMContentLoaded to ensure elements are loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeChoices();
    setupEventListeners();
});
