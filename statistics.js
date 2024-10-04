// statistics.js

const db = firebase.firestore();
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    if (currentUser) {
        loadAttendanceData();
    }
});

// Reuse the authentication functions from scripts.js
function checkAuthState() {
    currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) {
        // Redirect to sign-in page
        window.location.href = 'sign-in.html';
    }
}

function logout() {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'sign-in.html';
}

// Load Attendance Data and Generate Charts
async function loadAttendanceData() {
    try {
        const querySnapshot = await db.collection("attendance").get();
        const attendanceData = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            data.date = data.date.toDate().toISOString().split('T')[0];
            attendanceData.push(data);
        });
        generateAttendanceChart(attendanceData);
        generateMonthlyAttendanceChart(attendanceData);
    } catch (error) {
        console.error("Error loading attendance data: ", error);
    }
}

function generateAttendanceChart(data) {
    const attendanceCounts = data.reduce((counts, entry) => {
        if (!counts[entry.name]) {
            counts[entry.name] = { Attended: 0, Absent: 0, Excused: 0 };
        }
        counts[entry.name][entry.attendance]++;
        return counts;
    }, {});

    const labels = Object.keys(attendanceCounts);
    const attendedData = labels.map(name => attendanceCounts[name].Attended);
    const absentData = labels.map(name => attendanceCounts[name].Absent);
    const excusedData = labels.map(name => attendanceCounts[name].Excused);

    const ctx = document.getElementById('attendanceChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Attended',
                    data: attendedData,
                    backgroundColor: '#d4edda',
                    borderColor: '#d4edda'
                },
                {
                    label: 'Absent',
                    data: absentData,
                    backgroundColor: '#f8d7da',
                    borderColor: '#f8d7da'
                },
                {
                    label: 'Excused',
                    data: excusedData,
                    backgroundColor: '#fff3cd',
                    borderColor: '#fff3cd'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Person'
                    }
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            }
        }
    });
}

function generateMonthlyAttendanceChart(data) {
    const monthlyData = {};

    data.forEach(entry => {
        const month = entry.date.slice(0, 7); // Extract the month in YYYY-MM format
        if (!monthlyData[month]) {
            monthlyData[month] = { Attended: 0, Absent: 0, Excused: 0 };
        }
        if (monthlyData[month][entry.attendance] !== undefined) {
            monthlyData[month][entry.attendance]++;
        }
    });

    const labels = Object.keys(monthlyData);
    const attendedData = labels.map(month => monthlyData[month].Attended);
    const absentData = labels.map(month => monthlyData[month].Absent);
    const excusedData = labels.map(month => monthlyData[month].Excused);

    const ctx = document.getElementById('monthlyAttendanceChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Attended',
                    data: attendedData,
                    backgroundColor: '#d4edda',
                    borderColor: '#d4edda',
                    fill: false
                },
                {
                    label: 'Absent',
                    data: absentData,
                    backgroundColor: '#f8d7da',
                    borderColor: '#f8d7da',
                    fill: false
                },
                {
                    label: 'Excused',
                    data: excusedData,
                    backgroundColor: '#fff3cd',
                    borderColor: '#fff3cd',
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            }
        }
    });
}
