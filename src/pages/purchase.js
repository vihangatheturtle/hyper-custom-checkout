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

  if (typeof window !== "undefined") {
    window.addEventListener("message", function(event) {
      if (event.data == "FPCconn") {
       console.log("FPC handshake complete"); 
      } else if  (event.data == "FPCclosedone") {
       console.log("modal closed"); 
      }
    });
  }
  
  function closeModal() {
    parent.postMessage("FPCclose", "*");
  }
  
  async function handleSubmit(values, actions) {
    const cardElement = elements.getElement('card');

	if(release.plan.type !== "free"){
	  paymentMethod = await stripe.createPaymentMethod({
		type: 'card',
		card: cardElement,
		billing_details: { name: values.name.trim(), email: values.email.trim() },
	  }).then((result) => {
		if (result.error) {
			console.log(result.error.message);
			if (result.error.message == "Your card was declined.") {
				alert(result.error.message);
			}
			actions.setSubmitting(false);
			return null;
		}

		return result.paymentMethod;
	  });
	}

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
		parent.postMessage(`FPCsuccesskey${checkout.license.key}`, "*");
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
  <body className="bg-transparent">
    <script dangerouslySetInnerHTML={{ __html: `parent.postMessage("FPCprobe", "*");` }} />
    <div className="min-vh-100 d-flex align-items-center p-3">
      <div className="card border-dark rounded-lg mx-auto" style={{ maxWidth: '28rem' }}>
        <div className="card-header bg-dark text-light py-3">
          <button type="button" className="close text-light" aria-label="Close" onClick={closeModal}>
            <span aria-hidden="true">&times;</span>
          </button>
          <h4 className="mb-0">Purchase</h4>
        </div>
        <div className="card-body bg-dark text-light">

          <div>
            You are about to purchase a Cosmos AIO beta key. This is a pre-release key and will only be usable once Cosmos AIO releases.
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
                <button className="btn btn-primary w-100" type="submit" disabled={isSubmitting}>Pay £{(release.plan.amount / 100).toFixed(2)}</button>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  </body>
  );
}

export async function getServerSideProps({ query }) {
  const release = await retrieveRelease("pp");

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
