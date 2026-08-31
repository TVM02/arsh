'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Shield, User, Mail, Phone, MapPin, GraduationCap } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import useAuthStore from '@/lib/authStore';

export default function MasterRegister() {
  const { user, userData } = useAuthStore();
  const router = useRouter();
  
  // Redirect if not central admin
  useEffect(() => {
    if (userData && userData.role !== 'central_admin') {
      router.push('/unauthorized');
    }
  }, [userData, router]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    role: '',
    mahalId: '',
    // Teacher specific fields
    subjects: '',
    qualifications: '',
    experience: '',
    // Student specific fields
    rollNumber: '',
    classLevel: '',
    academicYear: '',
    fatherName: '',
    motherName: '',
    guardianPhone: '',
    previousEducation: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mahals, setMahals] = useState([]);

  // Fetch mahals for dropdown
  const fetchMahals = async () => {
    try {
      const mahalQuery = query(collection(db, 'mahals'));
      const snapshot = await getDocs(mahalQuery);
      const mahalList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMahals(mahalList);
    } catch (error) {
      console.error('Error fetching mahals:', error);
    }
  };

  useEffect(() => {
    fetchMahals();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validateForm = () => {
    if (!formData.fullName || !formData.email || !formData.password || !formData.role) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.role === 'student' && (!formData.rollNumber || !formData.classLevel)) {
      setError('Roll number and class level are required for students');
      return false;
    }

    if (formData.role === 'teacher' && !formData.subjects) {
      setError('Subjects are required for teachers');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Prepare user data for Firestore
      const userData = {
        uid: user.uid,
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone || '',
        dateOfBirth: formData.dateOfBirth || '',
        address: formData.address || '',
        role: formData.role,
        mahalId: formData.mahalId || '',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add role-specific fields
      if (formData.role === 'teacher') {
        userData.subjects = formData.subjects.split(',').map(s => s.trim());
        userData.qualifications = formData.qualifications || '';
        userData.experience = formData.experience || '';
      }

      if (formData.role === 'student') {
        userData.rollNumber = formData.rollNumber;
        userData.classLevel = formData.classLevel;
        userData.academicYear = formData.academicYear || new Date().getFullYear().toString();
        userData.fatherName = formData.fatherName || '';
        userData.motherName = formData.motherName || '';
        userData.guardianPhone = formData.guardianPhone || '';
        userData.previousEducation = formData.previousEducation || '';
        userData.admissionDate = new Date().toISOString();
      }

      // Save to Firestore users collection
      await setDoc(doc(db, 'users', user.uid), userData);

      // Also save to role-specific collection
      if (formData.role === 'teacher') {
        await setDoc(doc(db, 'teachers', user.uid), userData);
      } else if (formData.role === 'student') {
        await setDoc(doc(db, 'students', user.uid), userData);
      }

      setSuccess(`${formData.role} registered successfully!`);
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        dateOfBirth: '',
        address: '',
        role: '',
        mahalId: '',
        subjects: '',
        qualifications: '',
        experience: '',
        rollNumber: '',
        classLevel: '',
        academicYear: '',
        fatherName: '',
        motherName: '',
        guardianPhone: '',
        previousEducation: ''
      });

    } catch (error) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('Email is already registered');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="central_admin">
      <Layout user={user} role={userData?.role}>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-red-800">Master Registration</span>
              </div>
              <p className="text-gray-600">Create users for all roles with complete details</p>
            </div>

            <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-semibold text-center text-gray-800">
              Register New User
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Fill in all the required information
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="user@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="Enter password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Confirm password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select onValueChange={(value) => handleSelectChange('role', value)} value={formData.role}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="mahal_admin">Mahal Admin</SelectItem>
                        <SelectItem value="central_admin">Central Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mahalId">Mahal</Label>
                    <Select onValueChange={(value) => handleSelectChange('mahalId', value)} value={formData.mahalId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mahal" />
                      </SelectTrigger>
                      <SelectContent>
                        {mahals.map((mahal) => (
                          <SelectItem key={mahal.id} value={mahal.id}>
                            {mahal.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Contact & Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Contact & Personal Information</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Full address"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Role-specific fields */}
              {formData.role === 'teacher' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Teacher Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subjects">Subjects *</Label>
                      <Input
                        id="subjects"
                        name="subjects"
                        type="text"
                        value={formData.subjects}
                        onChange={handleChange}
                        placeholder="Math, Science, English (comma separated)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experience">Experience (years)</Label>
                      <Input
                        id="experience"
                        name="experience"
                        type="number"
                        value={formData.experience}
                        onChange={handleChange}
                        placeholder="Years of experience"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="qualifications">Qualifications</Label>
                      <Textarea
                        id="qualifications"
                        name="qualifications"
                        value={formData.qualifications}
                        onChange={handleChange}
                        placeholder="Educational qualifications and certifications"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.role === 'student' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Student Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rollNumber">Roll Number *</Label>
                      <Input
                        id="rollNumber"
                        name="rollNumber"
                        type="text"
                        value={formData.rollNumber}
                        onChange={handleChange}
                        placeholder="Student roll number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="classLevel">Class Level *</Label>
                      <Input
                        id="classLevel"
                        name="classLevel"
                        type="text"
                        value={formData.classLevel}
                        onChange={handleChange}
                        placeholder="Class level (e.g., 10th, 12th)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="academicYear">Academic Year</Label>
                      <Input
                        id="academicYear"
                        name="academicYear"
                        type="text"
                        value={formData.academicYear}
                        onChange={handleChange}
                        placeholder="2024-2025"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardianPhone">Guardian Phone</Label>
                      <Input
                        id="guardianPhone"
                        name="guardianPhone"
                        type="tel"
                        value={formData.guardianPhone}
                        onChange={handleChange}
                        placeholder="Guardian phone number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fatherName">Father&apos;s Name</Label>
                      <Input
                        id="fatherName"
                        name="fatherName"
                        type="text"
                        value={formData.fatherName}
                        onChange={handleChange}
                        placeholder="Father's name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="motherName">Mother&apos;s Name</Label>
                      <Input
                        id="motherName"
                        name="motherName"
                        type="text"
                        value={formData.motherName}
                        onChange={handleChange}
                        placeholder="Mother's name"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="previousEducation">Previous Education</Label>
                      <Textarea
                        id="previousEducation"
                        name="previousEducation"
                        value={formData.previousEducation}
                        onChange={handleChange}
                        placeholder="Previous educational background"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? 'Creating User...' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
