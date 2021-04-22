/* eslint-disable react/prop-types,react/destructuring-assignment */
import React from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useRouter } from 'next/router';
import { Field, Form, Formik } from 'formik';
import { createCheckout, pollCheckout } from '../services/checkout.service';
import { retrieveRelease } from '../services/release.service';

export default function Purchase({ release }) {
  const stripe = useStripe();
  const router = useRouter();
  const elements = useElements();

  async function handleSubmit(values, actions) {
    const cardElement = elements.getElement('card');

    const paymentMethod = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: { name: values.name.trim(), email: values.email.trim() },
    }).then((result) => {
      if (result.error) {
        alert(result.error.message);
        actions.setSubmitting(false);
        return null;
      }

      return result.paymentMethod;
    });

    await createCheckout({
      release: release.id,
      billing_details: {
        name: values.name,
        email: values.email,
      },
      payment_method: paymentMethod.id,
    }).then(async ({ id }) => {
      const checkout = await pollCheckout(id);

      if (checkout.status === 'succeeded') {
        await router.push(`/success?license=${checkout.license.key}`);
      } else {
        const paymentIntent = checkout.payment_intent_client_secret && await stripe.retrievePaymentIntent(checkout.payment_intent_client_secret);

        alert(`${paymentIntent?.last_payment_error.message || 'Your card was declined.'} Please try a different card.`);
        actions.setSubmitting(false);
      }
    }).catch((error) => {
      if (error.response.status === 400) {
        alert(error.response.data);
        actions.setSubmitting(false);
      } else alert(error);
    });
  }

  return (
    <style>
    body {
      margin:0;
      background-color: #191925;
    }

    ul {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: rgb(0,0,0,0);
      top: 0;
      width: 100%;
    }

    li a {
      display: block;
      color: white;
      text-align: center;
      padding: 6px 16px;
      text-decoration: none;
      color: white;
      font-family: arial;
    }

    .active {
      background-color: #4CAF50;
    }

    .left {
      float: left!important;
    }

    .right {
      float: right!important;
    }

    .bold {
      font-family: arial black!important;
    }

    .centerImg {
      display: block;
      margin-left: auto;
      margin-right: auto;
      vertical-align: middle;
        max-height: 100px;
        max-width: 100px;
    }

    .helper {
        display: inline-block;
        height: 100%;
        vertical-align: middle;
    }

    .vertical-center {
      top:50%;
      margin-top:-5em;
    }

    .pophovr {
      color:silver;
    }

    .pophovr:hover {
      font-size: 18.2px;
      color: white;
      padding-right: 6px!important;
    }

    .replaceBtn {
        border-radius: 4px;
        background-color: #202036;
        border: none;
        color: #565672;
        text-align: center;
        font-size: 16px;
      font-weight: bold;
        width: 180px;
        height: 37px;
        transition: all 0.5s;
        cursor: pointer;
        transition: .25s;
    }

    .bar1, .bar2, .bar3 {
      width: 35px;
      height: 5px;
      background-color: #fff;
      margin: 6px 0;
      transition: 0.4s;
    }

    .change .bar1 {
      -webkit-transform: rotate(-45deg) translate(-9px, 6px);
      transform: rotate(-45deg) translate(-9px, 6px);
    }

    .change .bar2 {opacity: 0;}

    .change .bar3 {
      -webkit-transform: rotate(45deg) translate(-8px, -8px);
      transform: rotate(45deg) translate(-8px, -8px);
    }

    #navBG {
      transition: .4s;
      position: absolute;
      z-index: 99;
      width: 100%;
      height: 0px;
      background-color: #090915;
    }
    </style>

    <div className="min-vh-100 d-flex align-items-center p-3 bg-light">
      <div className="card rounded-lg mx-auto border" style={{ maxWidth: '28rem' }}>
        <div className="card-header bg-white py-3">
          <h4 className="mb-0">Purchase</h4>
        </div>
        <div className="card-body">

          <div>
            You can modify this purchase page however you like stylistically. The only important part is that the
            inputs are linked up to the form!
          </div>
          <hr />
          <Formik
            initialValues={{
              name: '',
              email: '',
              card: '',
            }}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting }) => (
              <Form>
                <div className="form-group">
                  <label htmlFor="email">Email address</label>
                  <Field className="form-control" name="email" placeholder="johndoe@gmail.com" />
                </div>
                <div className="form-group">
                  <label htmlFor="name">Full name</label>
                  <Field className="form-control" name="name" placeholder="John Doe" />
                </div>
                {release.plan.amount !== 0 && (
                  <div className="form-group">
                    <label htmlFor="card">Card information</label>
                    <Field as={CardElement} className="form-control py-2" name="card" options={{
                      style: {
                        base: {
                          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Liberation Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"',
                          fontSize: '16px',
                          '::placeholder': {
                            color: '#6C757D',
                          },
                        },
                      },
                    }} />
                  </div>
                )}
                <button className="btn btn-primary w-100" type="submit" disabled={isSubmitting}>Pay now</button>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps({ query }) {
  const release = await retrieveRelease(query.password);

  if (!release) return {
    redirect: {
      destination: '/password',
      permanent: false,
    },
  };

  if (release.remaining_stock < 1) return {
    redirect: {
      destination: '/oos',
      permanent: false,
    },
  };

  return {
    props: {
      timestamp: Date.now(),
      release: release ? {
        trial_period_days: release.trial_period_days,
        initial_fee: release.initial_fee,
        plan: release.plan,
        id: release.id,
      } : null,
    },
  };
}
