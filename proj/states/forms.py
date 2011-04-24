from django import forms

class RegisterForm(forms.Form):
    regusername = forms.CharField(min_length=3, max_length=10, label="Username",
            widget=forms.TextInput(attrs={'class':'popup-input'}))
    regpassword = forms.CharField(min_length=5, max_length=20, label="Password", 
            widget=forms.PasswordInput(attrs={'class':'popup-input'}))
    regpassword2 = forms.CharField(min_length=5, max_length=20, label="Confirm", 
            widget=forms.PasswordInput(attrs={'class':'popup-input'}))
    regemail = forms.EmailField(max_length=75, required=False, label='Email (opt)',
            widget=forms.TextInput(attrs={'class':'popup-input'}))

class LoginForm(forms.Form):
    logusername = forms.CharField(min_length=3, label="Username",
            widget=forms.TextInput(attrs={'class':'popup-input'}))
    logpassword = forms.CharField(min_length=5, label="Password", 
            widget=forms.PasswordInput(attrs={'class':'popup-input'}))

